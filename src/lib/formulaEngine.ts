import { TableColumn, TableRow } from '../types';
import { formatEthiopian, parseEthiopianString, toEthiopian } from './ethiopianCalendar';

export interface FormulaContext {
  columns: TableColumn[];
  rows: TableRow[];
  cells: Record<string, any>; // key: `${row_id}_${column_id}`
  currentRowId: string;
}

export function parseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Converts a 0-based column index into standard spreadsheet letter(s) (0 -> A, 1 -> B, 25 -> Z, 26 -> AA, etc.)
 */
export function getColumnLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Converts column letter(s) (e.g. "A", "B", "AA") to 0-based index
 */
export function columnLetterToIndex(colLetter: string): number {
  const clean = colLetter.trim().toUpperCase();
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    index = index * 26 + (clean.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Evaluates a cell formula for a given row and column context
 */
export function evaluateFormula(formulaStr: string, context: FormulaContext): any {
  if (!formulaStr) return '';
  let formula = String(formulaStr).trim();
  if (formula.startsWith('=')) {
    formula = formula.substring(1).trim();
  }

  if (!formula) return '';

  try {
    // 1. First process high-level function calls (SUM, AVERAGE, MIN, MAX, IF, SUMIF, COUNTIF)
    let processedFormula = evaluateFunctions(formula, context);

    // 2. Build comprehensive column mapping:
    // Sort columns preserving stable array order
    const sortedCols = [...(context.columns || [])].sort((a, b) => {
      const posA = a.position !== undefined ? a.position : (context.columns || []).indexOf(a);
      const posB = b.position !== undefined ? b.position : (context.columns || []).indexOf(b);
      return posA - posB;
    });

    // A. Replace bracketed column references e.g. [Birr A], [Total A], [A], [Col 1]
    const bracketMatches = processedFormula.match(/\[([^\]]+)\]/g);
    if (bracketMatches) {
      for (const rawBracket of bracketMatches) {
        const inner = rawBracket.slice(1, -1).trim();
        const matchedCol = findColumn(inner, sortedCols);
        if (matchedCol) {
          const val = context.cells[`${context.currentRowId}_${matchedCol.id}`];
          const numVal = parseNumber(val);
          processedFormula = processedFormula.split(rawBracket).join(String(numVal));
        }
      }
    }

    // B. Replace explicit column names sorted by length descending so longer names match first
    const namedCols = [...sortedCols]
      .filter((c) => c.name && c.name.trim())
      .sort((a, b) => b.name.length - a.name.length);
    for (const col of namedCols) {
      const escaped = escapeRegex(col.name.trim());
      // Match whole word or exact name including Ethiopian / Amharic unicode words
      const nameRegex = new RegExp(`(?<=^|[^a-zA-Z0-9_\\u1200-\\u137F])${escaped}(?=[^a-zA-Z0-9_\\u1200-\\u137F]|$)`, 'gi');
      const val = context.cells[`${context.currentRowId}_${col.id}`];
      const numVal = parseNumber(val);
      processedFormula = processedFormula.replace(nameRegex, String(numVal));
    }

    // C. Replace column index patterns: Col1, Col 1, Column1, Column 1, C1, C2
    for (let idx = 0; idx < sortedCols.length; idx++) {
      const col = sortedCols[idx];
      const colNum = idx + 1;
      const patterns = [
        `(?<=^|[^a-zA-Z0-9_])col\\s*${colNum}(?=[^a-zA-Z0-9_]|$)`,
        `(?<=^|[^a-zA-Z0-9_])column\\s*${colNum}(?=[^a-zA-Z0-9_]|$)`,
        `(?<=^|[^a-zA-Z0-9_])c${colNum}(?=[^a-zA-Z0-9_]|$)`,
      ];
      for (const pat of patterns) {
        const regex = new RegExp(pat, 'gi');
        const val = context.cells[`${context.currentRowId}_${col.id}`];
        const numVal = parseNumber(val);
        processedFormula = processedFormula.replace(regex, String(numVal));
      }
    }

    // D. Replace column letters: A, B, C... Z, AA, AB... (e.g. A - B, a - b, A * B)
    // We sort letters in descending length so "AA" is processed before "A"
    const letterMappings: { letter: string; col: TableColumn }[] = [];
    sortedCols.forEach((col, idx) => {
      const letter = getColumnLetter(idx);
      letterMappings.push({ letter, col });
    });
    letterMappings.sort((a, b) => b.letter.length - a.letter.length);

    for (const { letter, col } of letterMappings) {
      // Look for standalone letter reference (case-insensitive word boundary)
      const letterRegex = new RegExp(`(?<=^|[^a-zA-Z0-9_])${letter}(?=[^a-zA-Z0-9_]|$)`, 'gi');
      const val = context.cells[`${context.currentRowId}_${col.id}`];
      const numVal = parseNumber(val);
      processedFormula = processedFormula.replace(letterRegex, String(numVal));
    }

    // 3. Safe arithmetic evaluation
    return safeMathEval(processedFormula);
  } catch (err) {
    console.warn('Formula eval error:', formulaStr, err);
    return '#ERROR!';
  }
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Enhanced column lookup by Name, Bracket, Index, or Letter (A, B, C...)
 */
export function findColumn(nameOrRef: string, columns: TableColumn[]): TableColumn | undefined {
  if (!nameOrRef) return undefined;
  const clean = nameOrRef.replace(/^\[|\]$/g, '').trim().toLowerCase();
  const sorted = [...columns].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // 1. Direct ID match
  const byId = sorted.find((c) => c.id.toLowerCase() === clean);
  if (byId) return byId;

  // 2. Exact Name match (case-insensitive)
  const byName = sorted.find((c) => c.name.trim().toLowerCase() === clean);
  if (byName) return byName;

  // 3. Col 1 / Column 1 / C1 match
  const colNumMatch = clean.match(/^(?:col|column|c)\s*(\d+)$/);
  if (colNumMatch) {
    const targetIdx = parseInt(colNumMatch[1], 10) - 1;
    if (targetIdx >= 0 && targetIdx < sorted.length) {
      return sorted[targetIdx];
    }
  }

  // 4. Letter match (e.g. "a" -> 0th, "b" -> 1st)
  if (/^[a-z]+$/.test(clean)) {
    const letterIdx = columnLetterToIndex(clean);
    if (letterIdx >= 0 && letterIdx < sorted.length) {
      return sorted[letterIdx];
    }
  }

  return undefined;
}

/**
 * Handle Functions: SUM, AVERAGE, COUNT, MIN, MAX, IF, SUMIF, COUNTIF
 */
function evaluateFunctions(expr: string, context: FormulaContext): string {
  let result = expr;

  // 1. IF(condition, true_val, false_val)
  result = result.replace(/IF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, trueVal, falseVal) => {
    try {
      const condEvaluated = safeConditionEval(cond, context);
      return condEvaluated ? trueVal.trim() : falseVal.trim();
    } catch {
      return '0';
    }
  });

  // 2. SUM(colName) or SUM(col1, col2, ...)
  result = result.replace(/SUM\s*\(([^)]+)\)/gi, (_, argsStr) => {
    const values = extractValuesFromArgs(argsStr, context);
    const sum = values.reduce((acc, curr) => acc + parseNumber(curr), 0);
    return String(sum);
  });

  // 3. AVERAGE(colName)
  result = result.replace(/AVERAGE\s*\(([^)]+)\)/gi, (_, argsStr) => {
    const values = extractValuesFromArgs(argsStr, context);
    if (values.length === 0) return '0';
    const sum = values.reduce((acc, curr) => acc + parseNumber(curr), 0);
    return String(sum / values.length);
  });

  // 4. COUNT(colName)
  result = result.replace(/COUNT\s*\(([^)]+)\)/gi, (_, argsStr) => {
    const values = extractValuesFromArgs(argsStr, context);
    return String(values.filter((v) => v !== '' && v !== null && v !== undefined).length);
  });

  // 5. MIN(colName)
  result = result.replace(/MIN\s*\(([^)]+)\)/gi, (_, argsStr) => {
    const values = extractValuesFromArgs(argsStr, context).map(parseNumber);
    if (values.length === 0) return '0';
    return String(Math.min(...values));
  });

  // 6. MAX(colName)
  result = result.replace(/MAX\s*\(([^)]+)\)/gi, (_, argsStr) => {
    const values = extractValuesFromArgs(argsStr, context).map(parseNumber);
    if (values.length === 0) return '0';
    return String(Math.max(...values));
  });

  // 7. SUMIF(rangeCol, criteria, [sumCol])
  result = result.replace(/SUMIF\s*\(([^,]+),([^,)]+)(?:,([^)]+))?\)/gi, (_, rangeCol, criteria, sumCol) => {
    const rangeColumnObj = findColumn(rangeCol.trim(), context.columns);
    const sumColumnObj = sumCol ? findColumn(sumCol.trim(), context.columns) : rangeColumnObj;
    if (!rangeColumnObj || !sumColumnObj) return '0';

    const crit = criteria.trim().replace(/^["']|["']$/g, '');
    let total = 0;

    for (const r of context.rows) {
      const rangeVal = String(context.cells[`${r.id}_${rangeColumnObj.id}`] ?? '').trim();
      const sumVal = parseNumber(context.cells[`${r.id}_${sumColumnObj.id}`]);

      if (matchCriteria(rangeVal, crit)) {
        total += sumVal;
      }
    }
    return String(total);
  });

  // 8. COUNTIF(rangeCol, criteria)
  result = result.replace(/COUNTIF\s*\(([^,]+),([^)]+)\)/gi, (_, rangeCol, criteria) => {
    const rangeColumnObj = findColumn(rangeCol.trim(), context.columns);
    if (!rangeColumnObj) return '0';

    const crit = criteria.trim().replace(/^["']|["']$/g, '');
    let count = 0;

    for (const r of context.rows) {
      const rangeVal = String(context.cells[`${r.id}_${rangeColumnObj.id}`] ?? '').trim();
      if (matchCriteria(rangeVal, crit)) {
        count++;
      }
    }
    return String(count);
  });

  return result;
}

function extractValuesFromArgs(argsStr: string, context: FormulaContext): any[] {
  const args = argsStr.split(',').map((s) => s.trim());
  const values: any[] = [];

  for (const arg of args) {
    const col = findColumn(arg, context.columns);
    if (col) {
      // If it's a full column reference, grab values for all rows
      for (const row of context.rows) {
        values.push(context.cells[`${row.id}_${col.id}`]);
      }
    } else {
      // Check if it is a single cell reference or number
      values.push(arg);
    }
  }

  return values;
}

function matchCriteria(val: string, criteria: string): boolean {
  if (criteria.startsWith('>=')) return parseNumber(val) >= parseNumber(criteria.slice(2));
  if (criteria.startsWith('<=')) return parseNumber(val) <= parseNumber(criteria.slice(2));
  if (criteria.startsWith('>')) return parseNumber(val) > parseNumber(criteria.slice(1));
  if (criteria.startsWith('<')) return parseNumber(val) < parseNumber(criteria.slice(1));
  if (criteria.startsWith('!=')) return val !== criteria.slice(2).trim();
  if (criteria.startsWith('=')) return val === criteria.slice(1).trim();
  return val.toLowerCase() === criteria.toLowerCase();
}

function safeConditionEval(condStr: string, context: FormulaContext): boolean {
  let processed = condStr;
  for (const col of context.columns) {
    const bracketRegex = new RegExp(`\\[${escapeRegex(col.name)}\\]`, 'gi');
    const wordRegex = new RegExp(`\\b${escapeRegex(col.name)}\\b`, 'gi');
    const val = context.cells[`${context.currentRowId}_${col.id}`];
    const numVal = parseNumber(val);
    processed = processed.replace(bracketRegex, String(numVal));
    processed = processed.replace(wordRegex, String(numVal));
  }

  if (processed.includes('>=')) {
    const [l, r] = processed.split('>=');
    return safeMathEval(l) >= safeMathEval(r);
  }
  if (processed.includes('<=')) {
    const [l, r] = processed.split('<=');
    return safeMathEval(l) <= safeMathEval(r);
  }
  if (processed.includes('>')) {
    const [l, r] = processed.split('>');
    return safeMathEval(l) > safeMathEval(r);
  }
  if (processed.includes('<')) {
    const [l, r] = processed.split('<');
    return safeMathEval(l) < safeMathEval(r);
  }
  if (processed.includes('==') || processed.includes('=')) {
    const [l, r] = processed.split(/==?=/);
    return safeMathEval(l) === safeMathEval(r);
  }
  return Boolean(safeMathEval(processed));
}

/**
 * Safe mathematical token parser & evaluator without unsafe eval()
 */
function safeMathEval(expr: string): number {
  if (!expr) return 0;
  // Convert percentage (e.g. 15% -> *0.01)
  let sanitized = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1*0.01)');
  // Strip out any non-arithmetic characters
  let cleanExpr = sanitized.replace(/[^0-9.+\-*/() ]/g, '').trim();
  // Strip trailing operators e.g. "500 -" or "500 +"
  cleanExpr = cleanExpr.replace(/[+\-*/\s]+$/, '').trim();
  // Replace double dashes/signs
  cleanExpr = cleanExpr.replace(/--/g, '+').replace(/\+\+/g, '+');
  if (!cleanExpr) return 0;

  try {
    // Function constructor limited strictly to pure math expressions
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${cleanExpr})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 1000000) / 1000000;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Formats a numeric value according to column formatting rules
 */
export function formatCellValue(
  value: any,
  columnOrFormat?: TableColumn | string,
  customCurrencySymbol?: string
): string {
  if (value === null || value === undefined || value === '') return '';

  let colType = 'text';
  let fmt = 'normal';
  let currencySym = customCurrencySymbol;

  if (columnOrFormat && typeof columnOrFormat === 'object') {
    colType = columnOrFormat.type;
    fmt = columnOrFormat.formatting?.numberFormat || (columnOrFormat.type === 'amount' ? 'currency_etb' : 'normal');
    currencySym = columnOrFormat.formatting?.currencySymbol || currencySym;
    if (columnOrFormat.type === 'checkbox') return value ? '✓' : '';
    if (columnOrFormat.type === 'image') return String(value);

    // Date Column Formatting (Ethiopian Calendar vs Gregorian)
    if (columnOrFormat.type === 'date') {
      const dateFormat = columnOrFormat.formatting?.dateFormat || (columnOrFormat.formatting?.calendarSystem === 'gregorian' ? 'gregorian_iso' : 'ethiopian_dd_mm_yyyy');
      const valStr = String(value).trim();
      if (!valStr) return '';

      if (dateFormat === 'ethiopian_dd_mm_yyyy') {
        return formatEthiopian(valStr, 'DD/MM/YYYY');
      } else if (dateFormat === 'ethiopian_text') {
        return formatEthiopian(valStr, 'Amharic');
      } else if (dateFormat === 'ethiopian_iso') {
        return formatEthiopian(valStr, 'YYYY-MM-DD');
      } else if (dateFormat === 'gregorian_slash') {
        const d = new Date(valStr);
        if (!isNaN(d.getTime())) {
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
        return valStr;
      } else if (dateFormat === 'gregorian_text') {
        const d = new Date(valStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return valStr;
      } else if (dateFormat === 'gregorian_iso') {
        const d = new Date(valStr);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
        return valStr;
      }

      // Default fallback for Ethiopian calendar
      if (columnOrFormat.formatting?.calendarSystem === 'ethiopian') {
        return formatEthiopian(valStr, 'DD/MM/YYYY');
      }
      return valStr;
    }
  } else if (typeof columnOrFormat === 'string') {
    fmt = columnOrFormat;
  }

  const num = parseNumber(value);
  if (isNaN(num)) {
    return String(value);
  }

  switch (fmt) {
    case '0_decimal':
      return Math.round(num).toLocaleString('en-US');
    case '2_decimal':
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case '3_decimal':
      return num.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    case 'comma':
      return num.toLocaleString('en-US');
    case 'currency_etb':
      return `${currencySym || 'ETB'} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'currency_usd':
      return `${currencySym || '$'}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'currency_eur':
      return `${currencySym || '€'}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:
      if (currencySym) {
        return `${currencySym} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return typeof value === 'number' ? String(value) : (isNaN(Number(value)) ? String(value) : String(num));
  }
}
