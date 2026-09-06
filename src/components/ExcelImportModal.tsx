import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Plus,
  RefreshCw,
  Layers,
  ArrowRight,
  Download,
  AlertTriangle,
  Database,
  Table as TableIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';
import {
  parseExcelOrCsvFile,
  ParsedImportData,
  generateTestExcelFile,
} from '../lib/excel';
import { SpreadsheetTable } from '../types';

interface ExcelImportModalProps {
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose }) => {
  const { t, tables, loadTables, openTable, manualSync } = useApp();
  const { user } = useAuth();

  const [parsedData, setParsedData] = useState<ParsedImportData | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [rawFile, setRawFile] = useState<File | null>(null);

  const [importMode, setImportMode] = useState<'new_table' | 'append' | 'replace'>('new_table');
  const [targetTableName, setTargetTableName] = useState('');
  const [selectedTableId, setSelectedTableId] = useState(tables[0]?.id || '');
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Import Execution & Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState<{
    percent: number;
    message: string;
    rowsProcessed: number;
    totalRows: number;
    cellsProcessed: number;
  }>({
    percent: 0,
    message: '',
    rowsProcessed: 0,
    totalRows: 0,
    cellsProcessed: 0,
  });

  const [completedResult, setCompletedResult] = useState<{
    tableId: string;
    tableName: string;
    columnsCount: number;
    rowsCount: number;
    cellsCount: number;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setIsProcessing(true);
    setRawFile(file);
    try {
      const data = await parseExcelOrCsvFile(file, 0);
      setParsedData(data);
      setSelectedSheetIndex(0);
      setTargetTableName(data.fileName.replace(/\.[^/.]+$/, ''));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to read spreadsheet file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSheetChange = async (sheetIdx: number) => {
    if (!rawFile) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const data = await parseExcelOrCsvFile(rawFile, sheetIdx);
      setParsedData(data);
      setSelectedSheetIndex(sheetIdx);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse selected sheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTestFile = () => {
    const { blob, filename } = generateTestExcelFile();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async (openImmediately = false) => {
    if (!parsedData || !user) {
      setErrorMsg('No user or spreadsheet data ready for import.');
      return;
    }

    if (importMode === 'replace' && !confirmReplace) {
      setErrorMsg('Please confirm replacing existing table data before proceeding.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const result = await dbService.importExcelDataset({
        userId: user.id,
        mode: importMode,
        targetTableName: targetTableName || parsedData.fileName,
        existingTableId: importMode !== 'new_table' ? selectedTableId : undefined,
        columns: parsedData.columns.map((c) => ({
          originalIndex: c.originalIndex,
          name: c.name,
          type: c.type,
        })),
        rawGrid: parsedData.rawGrid,
        onProgress: (p) => {
          setProgressState(p);
        },
      });

      // Reload tables to ensure state and navigation are fully updated
      await loadTables();
      await manualSync();

      if (openImmediately && result?.table?.id) {
        await openTable(result.table.id);
        onClose();
        return;
      }

      setCompletedResult({
        tableId: result.table.id,
        tableName: result.table.name,
        columnsCount: result.columnsCount,
        rowsCount: result.rowsCount,
        cellsCount: result.cellsCount,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Import failed. Please check your data and retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenImportedTable = async () => {
    if (completedResult?.tableId) {
      await openTable(completedResult.tableId);
      onClose();
    }
  };

  // Convert column index to Excel letters (0 -> A, 25 -> Z, 26 -> AA, 27 -> AB)
  const getColLetter = (idx: number): string => {
    let letter = '';
    let temp = idx;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  return (
    <div
      id="modal-excel-import"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-xs dark:bg-emerald-950 dark:text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t.import_excel}
                </h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Full Range Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Process complete worksheets (XLSX, XLS, CSV) • All columns & rows preserved
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {errorMsg && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Screen */}
          {completedResult ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md dark:bg-emerald-950 dark:text-emerald-300">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Excel import completed successfully!
              </h3>
              <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                The entire worksheet dataset has been stored permanently in Supabase and local IndexedDB.
              </p>

              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-950/60">
                <div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                    {completedResult.columnsCount}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Columns Saved
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {completedResult.rowsCount}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Data Rows
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                    {completedResult.cellsCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Cells Processed
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenImportedTable}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95"
                >
                  <TableIcon className="h-4 w-4" />
                  <span>Open '{completedResult.tableName}'</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : isProcessing ? (
            /* Progress Bar Screen */
            <div className="flex flex-col items-center justify-center space-y-5 py-12 text-center">
              <RefreshCw className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Importing Spreadsheet Data...
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {progressState.message || 'Saving rows and cells to Supabase database...'}
                </p>
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Progress</span>
                  <span>{progressState.percent}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-200"
                    style={{ width: `${progressState.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>
                    Rows: {progressState.rowsProcessed} / {progressState.totalRows}
                  </span>
                  <span>Cells: {progressState.cellsProcessed}</span>
                </div>
              </div>
            </div>
          ) : !parsedData ? (
            /* Upload Dropzone & Sample Generator */
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-10 text-center transition hover:border-blue-500 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-blue-500 dark:hover:bg-blue-950/20"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition group-hover:scale-110 dark:bg-blue-900/60 dark:text-blue-300">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900 dark:text-white">
                  Select Excel or CSV Spreadsheet
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  Drag and drop or browse files (.xlsx, .xls, .csv). Full columns range, formulas, and large row batches supported.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                >
                  Browse Computer
                </button>
              </div>

              {/* Instant Test Spreadsheet Generator (20 columns x 100 rows) */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Need a benchmark test file?
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Download our verified test sheet: 20 columns × 100 data rows (with empty cells, formulas, amounts, dates).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTestFile}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Test File</span>
                </button>
              </div>
            </div>
          ) : (
            /* Parsed File Overview & Preview */
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {parsedData.fileName}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        Detected: {parsedData.totalColumns} columns × {parsedData.totalRows} data rows
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Total Cells to save: {(parsedData.totalColumns * parsedData.totalRows).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {parsedData.sheetNames.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Sheet:
                      </label>
                      <select
                        value={selectedSheetIndex}
                        onChange={(e) => handleSheetChange(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                      >
                        {parsedData.sheetNames.map((sheet, idx) => (
                          <option key={idx} value={idx}>
                            {sheet}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setParsedData(null);
                      setRawFile(null);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Import Destination Options */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Import Target & Destination
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('new_table')}
                    className={`rounded-xl border p-3 text-left transition ${
                      importMode === 'new_table'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-700 font-bold dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">Create New Table</div>
                    <div className="text-[10px] text-slate-500">Create a fresh spreadsheet</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`rounded-xl border p-3 text-left transition ${
                      importMode === 'append'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-700 font-bold dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">Add Imported Rows</div>
                    <div className="text-[10px] text-slate-500">Append to existing table</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`rounded-xl border p-3 text-left transition ${
                      importMode === 'replace'
                        ? 'border-red-600 bg-red-50/70 text-red-700 font-bold dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-red-600 dark:text-red-400">
                      Replace Table Data
                    </div>
                    <div className="text-[10px] text-slate-500">Overwrite existing data</div>
                  </button>
                </div>

                {importMode === 'new_table' ? (
                  <div className="pt-1">
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      New Spreadsheet Name
                    </label>
                    <input
                      type="text"
                      value={targetTableName}
                      onChange={(e) => setTargetTableName(e.target.value)}
                      placeholder="e.g. Miyawa 3A Q1 Ledger"
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Select Target Table
                    </label>
                    <select
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>

                    {importMode === 'replace' && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p>
                            This will replace the existing table data. An automatic backup will be created before replacement.
                          </p>
                          <label className="mt-2 flex items-center gap-2 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={confirmReplace}
                              onChange={(e) => setConfirmReplace(e.target.checked)}
                              className="rounded text-red-600"
                            />
                            <span>I confirm replacing all existing data in this table</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Data Preview Table (Full Scrolling) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Live Data Preview (Horizontal & Vertical Scrolling)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Showing first 6 rows & last 3 rows • {parsedData.totalColumns} columns detected
                  </span>
                </div>

                <div className="max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner dark:border-slate-800 dark:bg-slate-950">
                  <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
                    <thead className="sticky top-0 z-10 bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="border-b border-r border-slate-200 px-3 py-2 text-center text-[10px] text-slate-400 dark:border-slate-700">
                          #
                        </th>
                        {parsedData.columns.map((c, colIdx) => (
                          <th
                            key={colIdx}
                            className="border-b border-r border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-700 dark:text-slate-200"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-mono">
                                {getColLetter(colIdx)}
                              </span>
                              <span className="font-bold">{c.name}</span>
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                                {c.type}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800">
                      {/* First 6 rows */}
                      {parsedData.rawGrid.slice(0, 6).map((row, rIdx) => (
                        <tr
                          key={`first-${rIdx}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <td className="border-r border-slate-200 px-2.5 py-1.5 text-center text-[10px] text-slate-400 dark:border-slate-700">
                            {rIdx + 1}
                          </td>
                          {parsedData.columns.map((c, cIdx) => (
                            <td
                              key={cIdx}
                              className="border-r border-slate-100 px-3 py-1.5 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                            >
                              {row[cIdx] !== undefined && row[cIdx] !== '' ? (
                                String(row[cIdx])
                              ) : (
                                <span className="text-slate-300 italic dark:text-slate-600">
                                  empty
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}

                      {/* Spacer if more rows exist */}
                      {parsedData.rawGrid.length > 9 && (
                        <tr className="bg-slate-50/80 text-center font-bold text-[11px] text-slate-500 dark:bg-slate-900/80">
                          <td
                            colSpan={parsedData.columns.length + 1}
                            className="py-1.5 tracking-wider"
                          >
                            ... {parsedData.rawGrid.length - 9} intermediate rows ...
                          </td>
                        </tr>
                      )}

                      {/* Last 3 rows */}
                      {parsedData.rawGrid.length > 6 &&
                        parsedData.rawGrid
                          .slice(Math.max(6, parsedData.rawGrid.length - 3))
                          .map((row, idx) => {
                            const actualRowNumber =
                              parsedData.rawGrid.length -
                              Math.max(6, parsedData.rawGrid.length - 3) +
                              idx +
                              Math.max(6, parsedData.rawGrid.length - 3);
                            return (
                              <tr
                                key={`last-${idx}`}
                                className="hover:bg-slate-50 dark:hover:bg-slate-900"
                              >
                                <td className="border-r border-slate-200 px-2.5 py-1.5 text-center text-[10px] text-slate-400 dark:border-slate-700">
                                  {actualRowNumber}
                                </td>
                                {parsedData.columns.map((c, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="border-r border-slate-100 px-3 py-1.5 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                                  >
                                    {row[cIdx] !== undefined && row[cIdx] !== '' ? (
                                      String(row[cIdx])
                                    ) : (
                                      <span className="text-slate-300 italic dark:text-slate-600">
                                        empty
                                      </span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs text-slate-500">
            {parsedData && !completedResult && !isProcessing && (
              <span>
                Ready to save {parsedData.totalColumns} columns and {parsedData.totalRows} data rows
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            >
              {completedResult ? 'Close' : 'Cancel'}
            </button>
            {parsedData && !completedResult && (
              <>
                <button
                  type="button"
                  disabled={isProcessing || (importMode === 'replace' && !confirmReplace)}
                  onClick={() => handleExecuteImport(false)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>
                    {isProcessing ? 'Importing...' : `Import All ${parsedData.totalRows} Rows`}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isProcessing || (importMode === 'replace' && !confirmReplace)}
                  onClick={() => handleExecuteImport(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                >
                  <TableIcon className="h-4 w-4" />
                  <span>
                    {isProcessing ? 'Importing...' : 'Import & Open Table'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
