import * as XLSX from 'xlsx';
import { ColumnType, TableColumn, TableRow } from '../types';

export interface ParsedImportColumn {
  originalIndex: number;
  name: string;
  type: ColumnType;
  sampleValues: any[];
}

export interface ParsedImportData {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  totalColumns: number;
  totalRows: number;
  columns: ParsedImportColumn[];
  // raw 2D grid: array of rows, where each row is an array of column values indexed 0..totalColumns-1
  rawGrid: any[][];
  // object rows mapping colName -> cell value
  rows: Record<string, any>[];
}

/**
 * Format Date or Excel Serial Date safely into standard YYYY-MM-DD
 */
export function formatExcelDate(value: any): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && value > 25000 && value < 60000) {
    // Excel serial number conversion
    try {
      const utcDays = Math.floor(value - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      if (!isNaN(dateInfo.getTime())) {
        const y = dateInfo.getUTCFullYear();
        const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateInfo.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // ignore
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Check if valid date string YYYY-MM-DD or DD/MM/YYYY
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed) && (trimmed.includes('-') || trimmed.includes('/'))) {
      const d = new Date(parsed);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  return String(value ?? '');
}

/**
 * Parses an Excel or CSV file completely without missing any columns or rows.
 */
export async function parseExcelOrCsvFile(file: File, sheetIndex = 0): Promise<ParsedImportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: true,
          cellText: true,
          cellFormula: true,
          dense: false,
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Workbook contains no readable sheets.');
        }

        const sheetName = workbook.SheetNames[sheetIndex] || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          throw new Error(`Worksheet '${sheetName}' could not be loaded.`);
        }

        // 1. Calculate true dimension boundaries (Never rely solely on !ref if it was truncated)
        let minRow = 0;
        let maxRow = 0;
        let minCol = 0;
        let maxCol = 0;
        let hasCells = false;

        if (worksheet['!ref']) {
          const parsedRef = XLSX.utils.decode_range(worksheet['!ref']);
          minRow = parsedRef.s.r;
          maxRow = parsedRef.e.r;
          minCol = parsedRef.s.c;
          maxCol = parsedRef.e.c;
          hasCells = true;
        }

        // Scan all keys to ensure we capture any cell beyond !ref boundaries
        const cellRefRegex = /^([A-Z]+)(\d+)$/;
        for (const key of Object.keys(worksheet)) {
          if (key.startsWith('!')) continue;
          if (cellRefRegex.test(key)) {
            const decoded = XLSX.utils.decode_cell(key);
            if (!hasCells) {
              minRow = decoded.r;
              maxRow = decoded.r;
              minCol = decoded.c;
              maxCol = decoded.c;
              hasCells = true;
            } else {
              if (decoded.r < minRow) minRow = decoded.r;
              if (decoded.r > maxRow) maxRow = decoded.r;
              if (decoded.c < minCol) minCol = decoded.c;
              if (decoded.c > maxCol) maxCol = decoded.c;
            }
          }
        }

        if (!hasCells) {
          throw new Error('Worksheet contains no data cells.');
        }

        const totalColCount = maxCol - minCol + 1;
        const totalRowCount = maxRow - minRow + 1;

        if (totalColCount <= 0 || totalRowCount <= 0) {
          throw new Error('No valid rows or columns found in the sheet.');
        }

        // 2. Extract Header Row (minRow)
        const rawHeaders: string[] = [];
        const seenNames = new Set<string>();

        for (let c = minCol; c <= maxCol; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r: minRow, c });
          const cell = worksheet[cellAddr];
          let headerText = '';

          if (cell) {
            if (cell.v !== undefined && cell.v !== null) {
              headerText = String(cell.v).trim();
            } else if (cell.w !== undefined && cell.w !== null) {
              headerText = String(cell.w).trim();
            }
          }

          if (!headerText) {
            headerText = `Column ${c - minCol + 1}`;
          }

          // Deduplicate column names if needed
          let uniqueName = headerText;
          let counter = 1;
          while (seenNames.has(uniqueName.toLowerCase())) {
            uniqueName = `${headerText} (${counter})`;
            counter++;
          }
          seenNames.add(uniqueName.toLowerCase());
          rawHeaders.push(uniqueName);
        }

        // 3. Extract All Data Rows (minRow + 1 to maxRow)
        const rawGrid: any[][] = [];
        const structuredRows: Record<string, any>[] = [];

        for (let r = minRow + 1; r <= maxRow; r++) {
          const rowArray: any[] = [];
          const rowObj: Record<string, any> = {};

          for (let c = minCol; c <= maxCol; c++) {
            const colIndex = c - minCol;
            const colName = rawHeaders[colIndex];
            const cellAddr = XLSX.utils.encode_cell({ r, c });
            const cell = worksheet[cellAddr];

            let cellValue: any = '';

            if (cell) {
              if (cell.f && (cell.v === undefined || cell.v === null || cell.v === '')) {
                // If it's a formula and value wasn't cached, keep formula or cell.w
                cellValue = cell.w || `=${cell.f}`;
              } else if (cell.t === 'd' || cell.v instanceof Date) {
                cellValue = formatExcelDate(cell.v || cell.w);
              } else if (cell.t === 'b') {
                cellValue = cell.v ? true : false;
              } else if (cell.t === 'n') {
                cellValue = typeof cell.v === 'number' ? cell.v : Number(cell.v);
              } else if (cell.v !== undefined && cell.v !== null) {
                // String or other type
                const str = String(cell.v).trim();
                // Check if it's boolean string
                if (str.toUpperCase() === 'TRUE') {
                  cellValue = true;
                } else if (str.toUpperCase() === 'FALSE') {
                  cellValue = false;
                } else {
                  cellValue = cell.v;
                }
              } else if (cell.w !== undefined && cell.w !== null) {
                cellValue = cell.w;
              }
            }

            rowArray.push(cellValue);
            rowObj[colName] = cellValue;
          }

          rawGrid.push(rowArray);
          structuredRows.push(rowObj);
        }

        // 4. Detect Column Types across all rows
        const columns: ParsedImportColumn[] = rawHeaders.map((colName, colIdx) => {
          const samples = rawGrid.map((row) => row[colIdx]);
          const detectedType = detectColumnType(samples);
          return {
            originalIndex: colIdx,
            name: colName,
            type: detectedType,
            sampleValues: samples.slice(0, 5),
          };
        });

        resolve({
          fileName: file.name,
          sheetNames: workbook.SheetNames,
          activeSheet: sheetName,
          totalColumns: columns.length,
          totalRows: structuredRows.length,
          columns,
          rawGrid,
          rows: structuredRows,
        });
      } catch (err: any) {
        reject(new Error(err?.message || 'Failed to parse spreadsheet worksheet.'));
      }
    };

    reader.onerror = () => reject(new Error('File reading error.'));
    reader.readAsArrayBuffer(file);
  });
}

function detectColumnType(samples: any[]): ColumnType {
  const nonEmpties = samples.filter((s) => s !== '' && s !== null && s !== undefined);
  if (nonEmpties.length === 0) return 'text';

  // Check for amount/currency
  const isCurrency = nonEmpties.every((s) => {
    if (typeof s === 'number') return true;
    const str = String(s).trim();
    return /^[+-]?[0-9,]+(\.[0-9]+)?$/.test(str.replace(/[$€£ETB\s]/gi, ''));
  });

  // Check for dates
  const isDate = nonEmpties.every((s) => {
    if (s instanceof Date) return true;
    const str = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return true;
    const parsed = Date.parse(str);
    return !isNaN(parsed) && (str.includes('-') || str.includes('/'));
  });

  if (isDate) return 'date';

  // Check for booleans
  const isAllBooleans = nonEmpties.every(
    (s) =>
      typeof s === 'boolean' ||
      String(s).toUpperCase() === 'TRUE' ||
      String(s).toUpperCase() === 'FALSE'
  );
  if (isAllBooleans) return 'checkbox';

  // Check for numbers
  const isAllNumbers = nonEmpties.every((s) => {
    if (typeof s === 'number') return true;
    const str = String(s).replace(/,/g, '').trim();
    return !isNaN(Number(str)) && str !== '';
  });

  if (isAllNumbers) {
    if (isCurrency && nonEmpties.some((s) => String(s).includes('.') || typeof s === 'number')) {
      return 'amount';
    }
    return 'number';
  }

  return 'text';
}

/**
 * Export table data to XLSX, CSV, or JSON
 */
export function exportTableData(
  tableName: string,
  columns: TableColumn[],
  rows: TableRow[],
  cells: Record<string, any>,
  format: 'xlsx' | 'csv' | 'json'
) {
  const safeName = tableName.trim().replace(/[/\\?%*:|"<>]/g, '_') || 'MAD_Spreadsheet';

  // Build 2D rows / object structure
  const exportHeaders = columns.map((c) => c.name);
  const dataRows = rows.map((r) => {
    const rowRecord: Record<string, any> = {};
    columns.forEach((c) => {
      const val = cells[`${r.id}_${c.id}`];
      rowRecord[c.name] = val !== undefined ? val : '';
    });
    return rowRecord;
  });

  if (format === 'json') {
    const jsonBlob = new Blob([JSON.stringify({ tableName, columns, rows: dataRows }, null, 2)], {
      type: 'application/json',
    });
    triggerDownload(jsonBlob, `${safeName}.json`);
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: exportHeaders });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  if (format === 'csv') {
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const csvBlob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(csvBlob, `${safeName}.csv`);
  } else {
    // xlsx
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerDownload(xlsxBlob, `${safeName}.xlsx`);
  }
}

/**
 * Generates a full 20 Columns x 100 Rows test Excel file with empty cells, dates,
 * formulas, amounts, booleans, and Amharic text for complete verification.
 */
export function generateTestExcelFile(): { blob: Blob; filename: string } {
  const headers = [
    'ID',
    'Customer Name',
    'Transaction Date',
    'Amount Birr',
    'Paid Amount',
    'Balance Due',
    'Status',
    'Verified',
    'Phone Number',
    'Branch Code',
    'Empty Column Test',
    'Partial Data',
    'Product Item',
    'Quantity',
    'Unit Price',
    'Total Price',
    'Tax 15%',
    'Grand Total',
    'Notes',
    'Batch Code',
  ];

  const statuses = ['Paid', 'Pending', 'Verified', 'Overdue'];
  const products = ["Ma'ed Salt 1kg", "Ma'ed Salt 500g", "Miyawa 3A Industrial Salt", "Table Salt Fine 250g"];
  const names = ['Abdi Usman', 'Fatima Ahmed', 'Bekele Molla', 'Chala Degefa', 'Tadesse Lemma', 'Selamawit Kebede', 'Yonas Haile', 'Aster Aweke'];

  const rows: any[][] = [];
  rows.push(headers);

  for (let i = 1; i <= 100; i++) {
    const qty = (i % 20) + 1;
    const unitPrice = 50 + (i % 10) * 15;
    const amount = qty * unitPrice;
    const paid = (i % 3 === 0) ? '' : (i % 2 === 0 ? amount : Math.floor(amount / 2));
    const balance = paid === '' ? amount : amount - (typeof paid === 'number' ? paid : 0);
    const dateStr = `2026-0${(i % 8) + 1}-${String((i % 27) + 1).padStart(2, '0')}`;
    const status = paid === amount ? 'Paid' : (paid === '' ? 'Pending' : 'Verified');
    const isVerified = (i % 2 === 0);

    // Partially empty cells test (every 5th row has empty phone, every 7th row has empty notes)
    const phone = (i % 5 === 0) ? '' : `+251911${String(100000 + i).slice(1)}`;
    const notes = (i % 7 === 0) ? '' : `Batch Ref #${1000 + i} - Standard Delivery`;
    const partialData = (i % 4 === 0) ? '' : `Code-${i * 7}`;

    const row = [
      i, // ID
      names[i % names.length], // Customer Name
      dateStr, // Transaction Date
      amount, // Amount Birr
      paid, // Paid Amount (can be empty)
      `=D${i + 1}-E${i + 1}`, // Formula string
      status, // Status
      isVerified, // Verified (Boolean)
      phone, // Phone Number (partially empty)
      `BR-${100 + (i % 15)}`, // Branch Code
      '', // Empty Column Test (Completely empty column across entire sheet)
      partialData, // Partial Data
      products[i % products.length], // Product Item
      qty, // Quantity
      unitPrice, // Unit Price
      `=N${i + 1}*O${i + 1}`, // Total Price Formula
      Math.round(amount * 0.15), // Tax
      Math.round(amount * 1.15), // Grand Total
      notes, // Notes
      `BATCH-2026-${String(i).padStart(4, '0')}`, // Batch Code
    ];

    rows.push(row);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'MAD_Test_20x100');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = 'MAD_Comprehensive_Test_20x100.xlsx';
  return { blob, filename };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
