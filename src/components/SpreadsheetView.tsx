import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Undo2,
  Redo2,
  Download,
  Upload,
  History,
  Archive,
  MoreVertical,
  Sliders,
  Trash2,
  Copy,
  ChevronDown,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Calendar,
  DollarSign,
  Hash,
  Type,
  Cpu,
  Image as ImageIcon,
  Sigma,
  Filter,
  ArrowUpDown,
  Lock,
  Eye,
  Check,
  Edit3,
  ArrowLeftRight,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  MoveLeft,
  MoveRight,
  Layers,
  Sparkles,
  RefreshCw,
  FolderOpen,
  FolderLock,
  KeyRound,
  ShieldCheck,
  FileEdit,
  PenLine,
  CheckCircle2,
  Save,
  Palette,
  Pipette,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MAD_PRODUCT_IMAGE } from '../assets/productImage';
import { dbService } from '../lib/db';
import { evaluateFormula, formatCellValue, parseNumber } from '../lib/formulaEngine';
import { exportTableData } from '../lib/excel';
import { ColumnPropertiesModal } from './ColumnPropertiesModal';
import { ColumnRenameModal } from './ColumnRenameModal';
import { ColumnDeleteModal } from './ColumnDeleteModal';
import { CellImageModal } from './CellImageModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { BackupModal } from './BackupModal';
import { ExcelImportModal } from './ExcelImportModal';
import { RowWritePad } from './RowWritePad';
import { AutoSuggestInput } from './AutoSuggestInput';
import { SpreadsheetTable, TableColumn, TableRow, ColumnType } from '../types';
import { formatLastOpenedTime, formatExactDateTime } from '../lib/dateUtils';
import { getTodayEthiopian } from '../lib/ethiopianCalendar';

const textSizeConfigs = {
  xs: {
    label: 'Compact',
    sizePx: '11px',
    fontSize: 'text-[11px]',
    cellPadding: 'py-1 px-1.5',
    inputPadding: 'py-0.5 px-1 text-[11px]',
    iconSize: 'h-3.5 w-3.5',
  },
  sm: {
    label: 'Small',
    sizePx: '12.5px',
    fontSize: 'text-xs',
    cellPadding: 'py-1.5 px-2',
    inputPadding: 'py-0.5 px-1.5 text-xs',
    iconSize: 'h-4 w-4',
  },
  base: {
    label: 'Standard',
    sizePx: '14px',
    fontSize: 'text-sm',
    cellPadding: 'py-2 px-2.5',
    inputPadding: 'py-1 px-2 text-sm',
    iconSize: 'h-4 w-4',
  },
  lg: {
    label: 'Large',
    sizePx: '16px',
    fontSize: 'text-base',
    cellPadding: 'py-2.5 px-3',
    inputPadding: 'py-1.5 px-2.5 text-base',
    iconSize: 'h-5 w-5',
  },
  xl: {
    label: 'Extra Large',
    sizePx: '19px',
    fontSize: 'text-lg',
    cellPadding: 'py-3.5 px-3.5',
    inputPadding: 'py-2 px-3 text-lg',
    iconSize: 'h-5 w-5',
  },
};

const textSizeOrder: ('xs' | 'sm' | 'base' | 'lg' | 'xl')[] = ['xs', 'sm', 'base', 'lg', 'xl'];

const COLOR_PALETTE = [
  { name: 'Default / Clear', hex: '' },
  { name: 'Soft Blue', hex: '#eff6ff' },
  { name: 'Soft Emerald', hex: '#ecfdf5' },
  { name: 'Soft Amber', hex: '#fefce8' },
  { name: 'Soft Orange', hex: '#fff7ed' },
  { name: 'Soft Rose', hex: '#fff1f2' },
  { name: 'Soft Purple', hex: '#f5f3ff' },
  { name: 'Soft Slate', hex: '#f1f5f9' },
  { name: 'Light Cyan', hex: '#ecfeff' },
  { name: 'Pastel Yellow', hex: '#fef9c3' },
  { name: 'Vibrant Blue', hex: '#bfdbfe' },
  { name: 'Vibrant Green', hex: '#bbf7d0' },
  { name: 'Vibrant Amber', hex: '#fef08a' },
  { name: 'Vibrant Red', hex: '#fecdd3' },
];

const EMPTY_SUGGESTIONS: string[] = [];

export const SpreadsheetView: React.FC = () => {
  const {
    activeTable,
    closeTable,
    refreshActiveTable,
    renameTable,
    insertRowWithData,
    updateRowData,
    updateActiveTableRowTextSize,
    updateActiveTableRowHeight,
    openPasswordModal,
    t,
  } = useApp();
  const { user } = useAuth();

  // Local state copy for instant zero-latency editing & offline typing
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [cells, setCells] = useState<Record<string, any>>({});
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedPaletteColor, setSelectedPaletteColor] = useState<string>('#eff6ff');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  // Row Write Pad & Last Save Time states
  const [isWritePadOpen, setIsWritePadOpen] = useState(false);
  const [writePadEditingRow, setWritePadEditingRow] = useState<TableRow | null>(null);
  const [lastRowSavedTime, setLastRowSavedTime] = useState<string | null>(null);

  // Search & Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumnId, setSortColumnId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterColumnId, setFilterColumnId] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string>('');

  // Preferences
  const [showRowNumbers, setShowRowNumbers] = useState(true);
  const [freezeHeader, setFreezeHeader] = useState(true);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<{ cells: Record<string, any> }[]>([]);
  const [redoStack, setRedoStack] = useState<{ cells: Record<string, any> }[]>([]);

  // Active column modals
  const [selectedColForProps, setSelectedColForProps] = useState<TableColumn | null>(null);
  const [selectedColForRename, setSelectedColForRename] = useState<TableColumn | null>(null);
  const [selectedColForDelete, setSelectedColForDelete] = useState<TableColumn | null>(null);
  const [selectedColForType, setSelectedColForType] = useState<TableColumn | null>(null);

  // Other modals
  const [imageModalConfig, setImageModalConfig] = useState<{
    rowId: string;
    columnId: string;
    url?: string;
  } | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [showTextSizeMenu, setShowTextSizeMenu] = useState(false);
  const [activeColMenuId, setActiveColMenuId] = useState<string | null>(null);
  const [writePadInitialColId, setWritePadInitialColId] = useState<string | undefined>(undefined);
  const [lastActiveColId, setLastActiveColId] = useState<string | undefined>(undefined);

  // Active editing cell
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editInputVal, setEditInputVal] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Active Text Size Config
  const currentTextSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl' = activeTable?.row_text_size || 'sm';
  const currentTextConfig = textSizeConfigs[currentTextSize] || textSizeConfigs.sm;

  const handleStepTextSize = (direction: 'up' | 'down') => {
    const currentIndex = textSizeOrder.indexOf(currentTextSize);
    if (direction === 'up' && currentIndex < textSizeOrder.length - 1) {
      updateActiveTableRowTextSize(textSizeOrder[currentIndex + 1]);
    } else if (direction === 'down' && currentIndex > 0) {
      updateActiveTableRowTextSize(textSizeOrder[currentIndex - 1]);
    }
  };

  // Column drag resizing state
  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const [resizingWidth, setResizingWidth] = useState<number | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(160);
  const resizingColRef = useRef<TableColumn | null>(null);

  // Sync state from activeTable
  useEffect(() => {
    if (activeTable) {
      const sortedCols = [...(activeTable.columns || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
      // Deduplicate columns by id
      const uniqueColsMap = new Map<string, TableColumn>();
      for (const col of sortedCols) {
        if (col && col.id) uniqueColsMap.set(col.id, col);
      }
      setColumns(Array.from(uniqueColsMap.values()));

      // Deduplicate rows by id
      const uniqueRowsMap = new Map<string, TableRow>();
      for (const r of activeTable.rows || []) {
        if (r && r.id) uniqueRowsMap.set(r.id, r);
      }
      setRows(Array.from(uniqueRowsMap.values()));
      setCells(activeTable.cells || {});
      setTitleValue(activeTable.name);
    }
  }, [activeTable]);

  const [isSavingFullState, setIsSavingFullState] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Focus input when editing cell starts
  useEffect(() => {
    if (editingCellKey && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCellKey]);

  const handleSaveAllChanges = async () => {
    if (!activeTable || !user || isSavingFullState) return;
    setIsSavingFullState(true);
    try {
      // Flush editing cell if any
      let currentCells = { ...cells };
      if (editingCellKey) {
        const [rId, cId] = editingCellKey.split('_');
        currentCells[editingCellKey] = editInputVal;
        setCells(currentCells);
        setEditingCellKey(null);
      }

      await dbService.saveFullTableState(
        activeTable.id,
        user.id,
        columns,
        rows,
        currentCells,
        'Save Button'
      );

      setSaveToast('Saved ✓');
      setTimeout(() => setSaveToast(null), 2500);
    } catch (err) {
      console.error('Error saving all table changes:', err);
    } finally {
      setIsSavingFullState(false);
    }
  };

  const handleBackSafely = async () => {
    // Unsaved cell data is not written to the row
    setEditingCellKey(null);
    setEditInputVal('');
    closeTable();
  };

  // Close open dropdowns when clicking outside
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveColMenuId(null);
      setShowExportMenu(false);
    };
    window.addEventListener('click', handleDocumentClick);
    return () => window.removeEventListener('click', handleDocumentClick);
  }, []);

  // Evaluate all calculated values for the entire spreadsheet
  const evaluatedCells = useMemo(() => {
    const computed: Record<string, any> = { ...cells };
    const formulaColumns = columns.filter((c) => c.type === 'formula');

    if (formulaColumns.length > 0) {
      // 2 passes to resolve chained formulas (e.g. formula column referencing another formula column)
      for (let pass = 0; pass < 2; pass++) {
        for (const row of rows) {
          for (const col of formulaColumns) {
            if (col.formula) {
              const res = evaluateFormula(col.formula, {
                columns,
                rows,
                cells: computed,
                currentRowId: row.id,
              });
              computed[`${row.id}_${col.id}`] = res;
            }
          }
        }
      }
    }

    return computed;
  }, [cells, columns, rows]);

  // Column auto-suggestions & typeahead dictionary for every column
  const columnSuggestionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    const ethToday = getTodayEthiopian();
    columns.forEach((col) => {
      const distinct = new Set<string>();
      if (col.type === 'date' && col.formatting?.calendarSystem === 'ethiopian') {
        distinct.add(ethToday.formattedSlash);
        distinct.add(ethToday.formattedAmharic);
      }
      rows.forEach((r) => {
        const val = cells[`${r.id}_${col.id}`];
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          if (str) distinct.add(str);
        }
      });
      // Also add selectOptions if available
      if (col.formatting?.selectOptions) {
        col.formatting.selectOptions.forEach((opt) => {
          if (opt && opt.trim()) distinct.add(opt.trim());
        });
      }
      map[col.id] = Array.from(distinct);
    });
    return map;
  }, [columns, rows, cells]);

  // Natural sequential rows preserving row_number order so new rows always appear at the bottom/last row
  const displayRows = useMemo(() => {
    let filtered = [...rows];
    // Keep in sequential row_number order
    filtered.sort((a, b) => (a.row_number || 0) - (b.row_number || 0));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((row) =>
        columns.some((col) => {
          const val = String(evaluatedCells[`${row.id}_${col.id}`] ?? '').toLowerCase();
          return val.includes(q);
        })
      );
    }

    if (filterColumnId && filterValue.trim()) {
      const fv = filterValue.toLowerCase().trim();
      filtered = filtered.filter((row) => {
        const val = String(evaluatedCells[`${row.id}_${filterColumnId}`] ?? '').toLowerCase();
        return val.includes(fv);
      });
    }

    return filtered;
  }, [rows, columns, evaluatedCells, searchQuery, filterColumnId, filterValue]);

  // Bottom Summary row calculations (Σ)
  const columnSummaries = useMemo(() => {
    const sums: Record<string, { sum: number; count: number; avg: number; hasNumbers: boolean }> = {};

    columns.forEach((col) => {
      let sum = 0;
      let count = 0;
      let hasNumbers = false;

      if (col.type === 'number' || col.type === 'amount' || col.type === 'formula') {
        hasNumbers = true;
        rows.forEach((row) => {
          const val = evaluatedCells[`${row.id}_${col.id}`];
          if (val !== undefined && val !== null && val !== '') {
            sum += parseNumber(val);
            count++;
          }
        });
      }

      sums[col.id] = {
        sum: Math.round(sum * 1000) / 1000,
        count,
        avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
        hasNumbers,
      };
    });

    return sums;
  }, [columns, rows, evaluatedCells]);

  // -------------------------------------------------------------
  // CELL EDITING & HISTORY STACK
  // -------------------------------------------------------------
  const isDateCol = (column: TableColumn) => {
    const colNameLower = (column.name || '').toLowerCase();
    return (
      column.type === 'date' ||
      colNameLower.includes('date') ||
      colNameLower.includes('ቀን') ||
      colNameLower.includes('ken')
    );
  };

  const handleCellClick = (rowId: string, column: TableColumn, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedRowId(rowId);
    setLastActiveColId(column.id);
    if (column.type === 'formula') {
      return;
    }

    // User request: clicking a row or cell directly shows the Box Pad (Row Write Pad) for that column
    const targetRow = rows.find((r) => r.id === rowId);
    if (targetRow) {
      handleOpenWritePadForEditRow(targetRow, column.id);
    }
  };

  const handleCellSave = (rowId: string, colId: string) => {
    if (editingCellKey) {
      const cellKey = `${rowId}_${colId}`;
      const originalVal = cells[cellKey] !== undefined ? String(cells[cellKey]) : '';
      if (editInputVal !== originalVal) {
        updateCellDirectly(rowId, colId, editInputVal);
      }
      setEditingCellKey(null);
    }
  };

  const handleCellCancel = () => {
    // Unsaved data must NOT be written to the row
    setEditingCellKey(null);
    setEditInputVal('');
  };

  const updateCellDirectly = async (rowId: string, colId: string, val: any) => {
    if (!activeTable || !user) return;
    const cellKey = `${rowId}_${colId}`;

    setUndoStack((prev) => [...prev, { cells: { ...cells } }]);
    setRedoStack([]);

    const nextCells = { ...cells, [cellKey]: val };
    setCells(nextCells);

    await dbService.updateCellValue(activeTable.id, rowId, colId, user.id, val);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, { cells: { ...cells } }]);
    setCells(last.cells);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, { cells: { ...cells } }]);
    setCells(next.cells);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
  };

  // -------------------------------------------------------------
  // TABLE MUTATIONS: ADD ROW / COL / DELETE & WRITE PAD
  // -------------------------------------------------------------
  const handleOpenWritePadForNewRow = (colId?: string) => {
    const targetColId = colId || lastActiveColId || (columns.length > 0 ? columns[0].id : undefined);
    setWritePadEditingRow(null);
    setWritePadInitialColId(targetColId);
    if (targetColId) {
      setLastActiveColId(targetColId);
    }
    setIsWritePadOpen(true);
  };

  const handleOpenWritePadForEditRow = (row: TableRow, colId?: string) => {
    const targetColId = colId || lastActiveColId || (columns.length > 0 ? columns[0].id : undefined);
    setWritePadEditingRow(row);
    setWritePadInitialColId(targetColId);
    if (targetColId) {
      setLastActiveColId(targetColId);
    }
    setIsWritePadOpen(true);
  };

  const handleSaveRowFromPad = async (
    cellValues: Record<string, any>,
    mode: 'INSERT' | 'EDIT',
    targetRowId?: string
  ): Promise<{ success: boolean; saveTime: string; rowNumber: number }> => {
    if (!activeTable || !user) throw new Error('No active table or user');

    setUndoStack((prev) => [...prev, { cells: { ...cells } }]);
    setRedoStack([]);

    if (mode === 'INSERT') {
      const nextRowNumber = rows.length + 1;
      const res = await insertRowWithData(activeTable.id, cellValues);
      const updatedRows = [...rows, res.row];
      const updatedCells = { ...cells, ...res.cells };
      setRows(updatedRows);
      setCells(updatedCells);
      setLastRowSavedTime(res.saveTime);
      await dbService.saveFullTableState(
        activeTable.id,
        user.id,
        columns,
        updatedRows,
        updatedCells,
        `Write & Insert Row #${res.row.row_number || nextRowNumber}`
      );
      return { success: true, saveTime: res.saveTime, rowNumber: res.row.row_number || nextRowNumber };
    } else {
      if (!targetRowId) throw new Error('Missing target row id for editing');
      const res = await updateRowData(activeTable.id, targetRowId, cellValues);
      const updatedRows = rows.map((r) => (r.id === targetRowId ? res.row : r));
      const updatedCells = { ...cells, ...res.cells };
      setRows(updatedRows);
      setCells(updatedCells);
      setLastRowSavedTime(res.saveTime);
      const targetRow = rows.find((r) => r.id === targetRowId);
      await dbService.saveFullTableState(
        activeTable.id,
        user.id,
        columns,
        updatedRows,
        updatedCells,
        `Write & Update Row #${targetRow?.row_number || 1}`
      );
      return { success: true, saveTime: res.saveTime, rowNumber: targetRow?.row_number || 1 };
    }
  };

  // -------------------------------------------------------------
  // COLUMN & ROW COLORING ("Set All Rows", "Set All Columns", etc.)
  // -------------------------------------------------------------
  const handleApplyColorToColumn = async (colId: string, color: string) => {
    if (!activeTable || !user) return;
    const updatedCols = columns.map((c) =>
      c.id === colId
        ? {
            ...c,
            styling: {
              ...c.styling,
              bgColor: color || undefined,
            },
          }
        : c
    );
    setColumns(updatedCols);
    const targetCol = updatedCols.find((c) => c.id === colId);
    if (targetCol) {
      await dbService.updateColumn(colId, user.id, { styling: targetCol.styling });
    }
    await dbService.saveFullTableState(activeTable.id, user.id, updatedCols, rows, cells, 'Column Color Changed');
    setSaveToast('Column color saved');
    setTimeout(() => setSaveToast(null), 2000);
  };

  const handleApplyColorToAllColumns = async (color: string) => {
    if (!activeTable || !user) return;
    const updatedCols = columns.map((c) => ({
      ...c,
      styling: {
        ...c.styling,
        bgColor: color || undefined,
      },
    }));
    setColumns(updatedCols);
    for (const c of updatedCols) {
      await dbService.updateColumn(c.id, user.id, { styling: c.styling });
    }
    await dbService.saveFullTableState(activeTable.id, user.id, updatedCols, rows, cells, 'All Columns Color Changed');
    setSaveToast('All columns color saved');
    setTimeout(() => setSaveToast(null), 2000);
  };

  const handleApplyColorToRow = async (color: string) => {
    if (!activeTable || !user || rows.length === 0) return;
    const targetRowId = selectedRowId || rows[0].id;
    const updatedRows = rows.map((r) =>
      r.id === targetRowId
        ? {
            ...r,
            styling: {
              ...r.styling,
              bgColor: color || undefined,
            },
          }
        : r
    );
    setRows(updatedRows);
    await dbService.saveFullTableState(activeTable.id, user.id, columns, updatedRows, cells, 'Row Color Changed');
    setSaveToast('Row color saved');
    setTimeout(() => setSaveToast(null), 2000);
  };

  const handleApplyColorToAllRows = async (color: string) => {
    if (!activeTable || !user || rows.length === 0) return;
    const updatedRows = rows.map((r) => ({
      ...r,
      styling: {
        ...r.styling,
        bgColor: color || undefined,
      },
    }));
    setRows(updatedRows);
    await dbService.saveFullTableState(activeTable.id, user.id, columns, updatedRows, cells, 'All Rows Color Changed');
    setSaveToast('All rows color saved');
    setTimeout(() => setSaveToast(null), 2000);
  };

  const handleApplyColorToAllTable = async (color: string) => {
    if (!activeTable || !user) return;
    const updatedCols = columns.map((c) => ({
      ...c,
      styling: {
        ...c.styling,
        bgColor: color || undefined,
      },
    }));
    const updatedRows = rows.map((r) => ({
      ...r,
      styling: {
        ...r.styling,
        bgColor: color || undefined,
      },
    }));
    setColumns(updatedCols);
    setRows(updatedRows);
    for (const c of updatedCols) {
      await dbService.updateColumn(c.id, user.id, { styling: c.styling });
    }
    await dbService.saveFullTableState(
      activeTable.id,
      user.id,
      updatedCols,
      updatedRows,
      cells,
      'All Rows & Columns Color Changed'
    );
    setSaveToast('All rows & columns color saved');
    setTimeout(() => setSaveToast(null), 2000);
  };

  const handleClearAllColors = async () => {
    if (!activeTable || !user) return;
    const updatedCols = columns.map((c) => ({
      ...c,
      styling: {
        ...c.styling,
        bgColor: undefined,
      },
    }));
    const updatedRows = rows.map((r) => ({
      ...r,
      styling: {
        ...r.styling,
        bgColor: undefined,
      },
    }));
    setColumns(updatedCols);
    setRows(updatedRows);
    for (const c of updatedCols) {
      await dbService.updateColumn(c.id, user.id, { styling: c.styling });
    }
    await dbService.saveFullTableState(activeTable.id, user.id, updatedCols, updatedRows, cells, 'Cleared All Colors');
    setSelectedPaletteColor('');
    setSaveToast('Colors cleared');
    setTimeout(() => setSaveToast(null), 2000);
  };

  const handleAddRow = async () => {
    if (!activeTable || !user) return;
    const maxRowNumber = rows.reduce((max, r) => Math.max(max, r.row_number || 0), 0);
    const nextRowNumber = Math.max(maxRowNumber + 1, rows.length + 1);
    const newRow = await dbService.addRow(activeTable.id, user.id, nextRowNumber);
    setRows((prev) => [...prev, newRow]);
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!activeTable || !user) return;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setCells((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${rowId}_`)) {
          delete next[key];
        }
      }
      return next;
    });
    await dbService.deleteRow(rowId, activeTable.id, user.id);
  };

  const handleAddColumn = async () => {
    if (!activeTable || !user) return;
    const newCol = await dbService.addColumn(activeTable.id, user.id, {
      name: `Column ${columns.length + 1}`,
      type: 'text',
      width: 160,
      position: columns.length,
    });
    setColumns((prev) => [...prev, newCol]);
  };

  // -------------------------------------------------------------
  // COLUMN ACTIONS
  // -------------------------------------------------------------
  const handleDirectRename = async (newName: string) => {
    if (!selectedColForRename || !user || !activeTable) return;
    await dbService.updateColumn(selectedColForRename.id, user.id, { name: newName });
    const nextCols = columns.map((c) => (c.id === selectedColForRename.id ? { ...c, name: newName } : c));
    setColumns(nextCols);
    await dbService.saveFullTableState(
      activeTable.id,
      user.id,
      nextCols,
      rows,
      cells,
      `Rename Column to ${newName}`
    );
  };

  const handleSaveColumnProps = async (updates: Partial<TableColumn>) => {
    if (!selectedColForProps || !user) return;
    await dbService.updateColumn(selectedColForProps.id, user.id, updates);
    const nextCols = columns.map((c) => (c.id === selectedColForProps.id ? { ...c, ...updates } : c));
    setColumns(nextCols);
    if (activeTable) {
      await dbService.saveFullTableState(
        activeTable.id,
        user.id,
        nextCols,
        rows,
        cells,
        `Update Column Properties (${updates.name || selectedColForProps.name})`
      );
    }
  };

  const handleChangeColumnType = async (newType: ColumnType) => {
    if (!selectedColForType || !user) return;
    const updates: Partial<TableColumn> = { type: newType };
    if (newType === 'amount') {
      updates.formatting = { ...selectedColForType.formatting, numberFormat: 'currency_etb' };
    }
    await dbService.updateColumn(selectedColForType.id, user.id, updates);
    const updatedCol = { ...selectedColForType, ...updates };
    const nextCols = columns.map((c) => (c.id === selectedColForType.id ? updatedCol : c));
    setColumns(nextCols);
    if (activeTable) {
      await dbService.saveFullTableState(
        activeTable.id,
        user.id,
        nextCols,
        rows,
        cells,
        `Change Column Type to ${newType}`
      );
    }
    const targetCol = updatedCol;
    setSelectedColForType(null);
    if (newType === 'formula') {
      setSelectedColForProps(targetCol);
    }
  };

  const handleInsertColumnLeft = async (col: TableColumn) => {
    if (!activeTable || !user) return;
    await dbService.insertColumnAt(
      activeTable.id,
      col.id,
      'left',
      { name: `Column ${columns.length + 1}`, type: 'text', width: 160 },
      user.id
    );
    const refreshed = await dbService.getTableDetail(activeTable.id, user.id);
    if (refreshed) {
      setColumns(refreshed.columns || []);
      setCells(refreshed.cells || {});
    }
    setActiveColMenuId(null);
  };

  const handleInsertColumnRight = async (col: TableColumn) => {
    if (!activeTable || !user) return;
    await dbService.insertColumnAt(
      activeTable.id,
      col.id,
      'right',
      { name: `Column ${columns.length + 1}`, type: 'text', width: 160 },
      user.id
    );
    const refreshed = await dbService.getTableDetail(activeTable.id, user.id);
    if (refreshed) {
      setColumns(refreshed.columns || []);
      setCells(refreshed.cells || {});
    }
    setActiveColMenuId(null);
  };

  const handleDuplicateColumn = async (colId: string) => {
    if (!activeTable || !user) return;
    const duplicated = await dbService.duplicateColumn(colId, activeTable.id, user.id);
    if (duplicated) {
      const refreshed = await dbService.getTableDetail(activeTable.id, user.id);
      if (refreshed) {
        setColumns(refreshed.columns || []);
        setCells(refreshed.cells || {});
      }
    }
    setActiveColMenuId(null);
  };

  const handleMoveColumn = async (colId: string, direction: 'left' | 'right') => {
    if (!activeTable || !user) return;
    const reordered = await dbService.moveColumn(activeTable.id, colId, direction, user.id);
    setColumns([...reordered]);
    setActiveColMenuId(null);
  };

  const handleDeleteColumnConfirm = async () => {
    if (!selectedColForDelete || !activeTable || !user) return;
    const colId = selectedColForDelete.id;
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setCells((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.endsWith(`_${colId}`)) {
          delete next[key];
        }
      }
      return next;
    });
    setSelectedColForDelete(null);
    await dbService.deleteColumn(colId, activeTable.id, user.id);
  };

  // -------------------------------------------------------------
  // COLUMN DRAG RESIZING HANDLERS
  // -------------------------------------------------------------
  const startColumnResize = (e: React.MouseEvent, col: TableColumn) => {
    e.stopPropagation();
    e.preventDefault();
    resizingColRef.current = col;
    setResizingColId(col.id);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = col.width || 160;
    setResizingWidth(col.width || 160);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - resizeStartXRef.current;
      const newWidth = Math.max(60, Math.min(600, resizeStartWidthRef.current + diff));
      setResizingWidth(newWidth);
      setColumns((prev) =>
        prev.map((c) => (c.id === col.id ? { ...c, width: newWidth } : c))
      );
    };

    const onMouseUp = async (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const diff = upEvent.clientX - resizeStartXRef.current;
      const finalWidth = Math.max(60, Math.min(600, resizeStartWidthRef.current + diff));

      setResizingColId(null);
      setResizingWidth(null);

      if (user) {
        await dbService.updateColumn(col.id, user.id, { width: finalWidth });
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSaveTitle = async () => {
    if (activeTable && titleValue.trim()) {
      await renameTable(activeTable.id, titleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const handleSortToggle = (colId: string) => {
    if (sortColumnId === colId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumnId(null);
      }
    } else {
      setSortColumnId(colId);
      setSortDirection('asc');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'number':
        return Hash;
      case 'amount':
        return DollarSign;
      case 'date':
        return Calendar;
      case 'checkbox':
        return CheckSquare;
      case 'formula':
        return Cpu;
      case 'image':
        return ImageIcon;
      default:
        return Type;
    }
  };

  if (!activeTable) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 font-sans">
      {/* 1. GEOMETRIC BALANCE SPREADSHEET TOOLBAR */}
      <div
        id="spreadsheet-toolbar"
        className="z-20 flex flex-col justify-center bg-[#1E40AF] px-4 py-2.5 text-white shadow-md sm:px-6 dark:bg-[#1E3A8A]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Back button, Logo, & Editable Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-toolbar-back"
              onClick={handleBackSafely}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-800/60 text-white transition hover:bg-blue-700 active:scale-95 cursor-pointer"
              title="Save and back to tables"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* App Icon */}
            <div className="relative hidden h-7 w-7 shrink-0 overflow-hidden rounded-md border border-white/20 sm:block">
              <img
                src={MAD_PRODUCT_IMAGE}
                alt="App Logo"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  className="h-8 rounded-lg bg-white px-2.5 text-xs font-bold text-slate-900 focus:outline-none"
                />
                <button
                  onClick={handleSaveTitle}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-blue-900 shadow-sm"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="cursor-pointer text-sm font-extrabold tracking-tight hover:underline sm:text-base"
                  title="Click to rename"
                >
                  {activeTable.name}
                </h1>
                <span className="hidden rounded-md bg-blue-800/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200 sm:inline">
                  Miyawa 3A
                </span>
                {/* Last Open Time pill */}
                <span
                  className="hidden md:inline-flex items-center gap-1 rounded-md bg-blue-800/40 px-2 py-0.5 text-[10px] font-medium text-blue-200"
                  title="Last open timestamp"
                >
                  <FolderOpen className="h-2.5 w-2.5" />
                  {formatLastOpenedTime(activeTable.last_opened_at || activeTable.updated_at)}
                </span>
                {/* Last Device & Browser Modification badge */}
                <span
                  className="hidden lg:inline-flex items-center gap-1 rounded-md bg-blue-900/60 border border-blue-400/30 px-2 py-0.5 text-[10px] font-medium text-blue-100"
                  title={`Last change by ${activeTable.last_modified_by_device || 'Device'} (${activeTable.last_modified_by_browser || 'Browser'}) via ${activeTable.last_change_method || 'Update'} at ${formatExactDateTime(activeTable.last_modified_date_time || activeTable.updated_at)}`}
                >
                  <span>{activeTable.last_modified_by_device_type === 'phone' ? '📱' : '💻'} {activeTable.last_modified_by_device || 'Device'}</span>
                  <span className="text-blue-300">({activeTable.last_modified_by_browser || 'Browser'})</span>
                  {activeTable.last_change_method && (
                    <span className="text-emerald-300 font-bold">• {activeTable.last_change_method}</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Center: Search inside table */}
          <div className="relative min-w-[140px] max-w-xs flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-blue-200" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table data..."
              className="h-7 w-full rounded-full border-none bg-blue-800/50 pl-8 pr-2.5 text-xs text-white placeholder-blue-200/80 focus:ring-2 focus:ring-blue-300 focus:outline-none"
            />
          </div>

          {/* Right Action Controls: Horizontally scrollable & touch-friendly so NO option is hidden on mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 max-w-full touch-pan-x shrink-0">
            {/* Save Button Group with Write File - Save & Insert Row option */}
            <div className="flex items-center rounded-md bg-emerald-600 shadow-xs shrink-0">
              <button
                id="btn-toolbar-save-all"
                onClick={handleSaveAllChanges}
                disabled={isSavingFullState}
                className={`flex h-7 items-center gap-1.5 rounded-l-md px-2.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                  saveToast
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                }`}
                title="Save all spreadsheet data, formulas, and modifications instantly to file"
              >
                <Save className={`h-3.5 w-3.5 ${isSavingFullState ? 'animate-spin' : ''}`} />
                <span>{isSavingFullState ? 'Saving...' : saveToast ? 'Saved ✓' : 'Save'}</span>
              </button>
              <div className="h-4 w-px bg-emerald-700/60" />
              <button
                id="btn-toolbar-save-insert-row"
                onClick={() => handleOpenWritePadForNewRow()}
                className="flex h-7 items-center gap-1 rounded-r-md bg-emerald-600 px-2 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 cursor-pointer transition shrink-0"
                title="Write File - Save & Insert Row (Opens row write box similar to Screenshot 2)"
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">Insert Row</span>
              </button>
            </div>

            {/* Row Write Box (Table Notes 2nd Screenshot Method) */}
            <button
              id="btn-toolbar-write-pad"
              onClick={() => handleOpenWritePadForNewRow()}
              className="flex h-7 items-center gap-1.5 rounded-md bg-amber-400 px-2.5 text-xs font-bold text-blue-950 shadow-xs hover:bg-amber-300 active:scale-95 cursor-pointer transition shrink-0"
              title="Open Table Notes Row Write Box (voice input, pill input, date/time chips, save to file)"
            >
              <FileEdit className="h-3.5 w-3.5" />
              <span>Write Row</span>
            </button>

            {/* Add Row Button - adds blank row directly to spreadsheet without showing write pad */}
            <button
              id="btn-toolbar-add-row"
              onClick={handleAddRow}
              className="flex h-7 items-center gap-1 rounded-md bg-white/15 px-2.5 text-xs font-bold text-white hover:bg-white/25 active:scale-95 cursor-pointer shrink-0"
              title="Add blank row only to spreadsheet"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.add_row}</span>
            </button>

            {/* Add Column Button */}
            <button
              id="btn-toolbar-add-column"
              onClick={handleAddColumn}
              className="flex h-7 items-center gap-1 rounded-md bg-white/15 px-2.5 text-xs font-bold text-white hover:bg-white/25 active:scale-95 cursor-pointer shrink-0"
              title="Add new column"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.add_column}</span>
            </button>

            {/* Refresh Active Table & Cloud Changes */}
            <button
              id="btn-toolbar-refresh-table"
              onClick={refreshActiveTable}
              className="flex h-7 items-center gap-1 rounded bg-white/15 px-2 text-xs font-semibold text-white hover:bg-white/25 active:scale-95 cursor-pointer shrink-0"
              title="Refresh and sync this spreadsheet with database"
            >
              <RefreshCw className="h-3 w-3 text-emerald-300" />
              <span>Sync</span>
            </button>

            {/* Undo / Redo */}
            <button
              id="btn-toolbar-undo"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 shrink-0"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>

            <button
              id="btn-toolbar-redo"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 shrink-0"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-white/20 shrink-0" />

            {/* Folder Security & Password Button */}
            <button
              id="btn-toolbar-folder-security"
              onClick={() => {
                if (activeTable) {
                  openPasswordModal(activeTable, activeTable.is_password_protected ? 'LOOKUP' : 'SET');
                }
              }}
              className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${
                activeTable.is_password_protected
                  ? 'bg-amber-400/30 text-amber-200 border border-amber-400/50 hover:bg-amber-400/40'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={
                activeTable.is_password_protected
                  ? 'Password Protected (Click for password lookup / settings)'
                  : 'Set Folder / Table Password'
              }
            >
              {activeTable.is_password_protected ? (
                <Lock className="h-3.5 w-3.5 text-amber-300" />
              ) : (
                <FolderLock className="h-3.5 w-3.5 text-blue-200" />
              )}
              <span>
                {activeTable.is_password_protected ? 'Protected' : 'Lock'}
              </span>
            </button>

            {/* Version History */}
            <button
              id="btn-toolbar-version-history"
              onClick={() => setShowVersionHistory(true)}
              className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 shrink-0"
              title="Table Version History"
            >
              <History className="h-3.5 w-3.5" />
            </button>

            {/* Backups */}
            <button
              id="btn-toolbar-backups"
              onClick={() => setShowBackups(true)}
              className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 shrink-0"
              title="Table Backups"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>

            {/* Export Dropdown */}
            <div className="relative shrink-0">
              <button
                id="btn-toolbar-export"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportMenu(!showExportMenu);
                }}
                className="flex h-7 items-center gap-1 rounded-md bg-white px-2.5 text-xs font-bold text-blue-900 shadow hover:bg-blue-50 active:scale-95 shrink-0"
              >
                <Download className="h-3.5 w-3.5 text-blue-700" />
                <span>Export</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {showExportMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                >
                  <button
                    onClick={() => {
                      exportTableData(activeTable.name, columns, rows, evaluatedCells, 'xlsx');
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => {
                      exportTableData(activeTable.name, columns, rows, evaluatedCells, 'csv');
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                    CSV (.csv)
                  </button>
                  <button
                    onClick={() => {
                      exportTableData(activeTable.name, columns, rows, evaluatedCells, 'json');
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600" />
                    JSON (.json)
                  </button>
                </div>
              )}
            </div>

            {/* Mobile / Compact Quick Menu Button to access ANY option instantly */}
            <div className="relative shrink-0">
              <button
                id="btn-toolbar-more-menu"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMobileMoreMenu(!showMobileMoreMenu);
                }}
                className="flex h-7 items-center gap-1 rounded bg-white/20 px-2 text-xs font-bold text-white hover:bg-white/30 active:scale-95 cursor-pointer shrink-0"
                title="More table options & menu (all options visible)"
              >
                <MoreVertical className="h-3.5 w-3.5" />
                <span className="text-[11px]">More</span>
              </button>

              {showMobileMoreMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-8 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95"
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                    All Header Options
                  </div>

                  <button
                    onClick={() => {
                      handleOpenWritePadForNewRow();
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-amber-50 hover:text-amber-900 text-amber-700 dark:hover:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                  >
                    <FileEdit className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-bold">Write Row Box</div>
                      <div className="text-[10px] text-slate-400">Table Notes method (voice/time)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleAddRow();
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-blue-600" />
                    <span>Add Blank Row</span>
                  </button>

                  <button
                    onClick={() => {
                      handleAddColumn();
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-emerald-600" />
                    <span>Add Column</span>
                  </button>

                  <button
                    onClick={() => {
                      handleSaveAllChanges();
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Save className="h-4 w-4 text-emerald-600" />
                    <span>Save Table Data</span>
                  </button>

                  <button
                    onClick={() => {
                      refreshActiveTable();
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4 text-blue-500" />
                    <span>Sync with Database</span>
                  </button>

                  <button
                    onClick={() => {
                      openPasswordModal(activeTable, activeTable.is_password_protected ? 'LOOKUP' : 'SET');
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Lock className="h-4 w-4 text-amber-500" />
                    <span>{activeTable.is_password_protected ? 'Folder Lock Settings' : 'Lock Table / Folder'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowVersionHistory(true);
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <History className="h-4 w-4 text-purple-500" />
                    <span>Version History</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowBackups(true);
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Archive className="h-4 w-4 text-indigo-500" />
                    <span>Table Backups</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowImportModal(true);
                      setShowMobileMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 text-teal-500" />
                    <span>Import Excel / CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub-toolbar: Freeze controls, Row text size controls & Row count */}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-1.5 text-[11px] text-blue-100 overflow-x-auto no-scrollbar whitespace-nowrap">
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex cursor-pointer items-center gap-1 shrink-0">
              <input
                type="checkbox"
                checked={showRowNumbers}
                onChange={(e) => setShowRowNumbers(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>{t.show_row_numbers}</span>
            </label>

            <label className="flex cursor-pointer items-center gap-1 shrink-0">
              <input
                type="checkbox"
                checked={freezeHeader}
                onChange={(e) => setFreezeHeader(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>{t.freeze_header}</span>
            </label>

            {/* Row Text Size Customizer */}
            <div className="relative flex items-center rounded-lg bg-blue-900/70 p-0.5 border border-blue-400/40 text-white shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => handleStepTextSize('down')}
                disabled={currentTextSize === 'xs'}
                className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                title="Decrease row text size (A-)"
              >
                A-
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTextSizeMenu(!showTextSizeMenu);
                }}
                className="flex items-center gap-1 px-1.5 text-[10px] font-semibold hover:bg-white/15 rounded cursor-pointer"
                title="Select row text size"
              >
                <Type className="h-2.5 w-2.5 text-blue-300" />
                <span>Text: {currentTextConfig.label}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => handleStepTextSize('up')}
                disabled={currentTextSize === 'xl'}
                className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                title="Increase row text size (A+)"
              >
                A+
              </button>

              {/* Text Size Menu Dropdown */}
              {showTextSizeMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-7 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Row Text Size
                  </div>
                  {textSizeOrder.map((key) => {
                    const conf = textSizeConfigs[key];
                    const isSelected = key === currentTextSize;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          updateActiveTableRowTextSize(key);
                          setShowTextSizeMenu(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{conf.label}</span>
                        <span className="font-mono text-[10px] opacity-60">{conf.sizePx}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedRowId && (
              <button
                type="button"
                onClick={() => {
                  const selRow = rows.find((r) => r.id === selectedRowId);
                  if (selRow) handleOpenWritePadForEditRow(selRow);
                }}
                className="flex items-center gap-1 rounded bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95 px-2 py-0.5 text-[10px] font-bold shadow-xs transition cursor-pointer shrink-0"
                title="1-Click to edit selected row in Write Pad and save data"
              >
                <FileEdit className="h-3 w-3" />
                <span>
                  Edit Row #
                  {rows.find((r) => r.id === selectedRowId)?.row_number ||
                    rows.findIndex((r) => r.id === selectedRowId) + 1}{' '}
                  (Write Pad)
                </span>
              </button>
            )}

            <span>
              {displayRows.length} {displayRows.length === 1 ? 'Row' : 'Rows'} • {columns.length}{' '}
              {columns.length === 1 ? 'Column' : 'Columns'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SPREADSHEET GRID VIEW CONTAINER */}
      <div className="relative flex-1 overflow-auto bg-white dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs font-medium">
          {/* SPREADSHEET HEADER ROW */}
          <thead className={freezeHeader ? 'sticky top-0 z-10 shadow-xs' : ''}>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {/* Optional Row Number Column Header */}
              {showRowNumbers && (
                <th className="w-12 border-r border-slate-300 bg-slate-200/80 p-2 text-center font-mono text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                  #
                </th>
              )}

              {/* Dynamic Column Headers */}
              {columns.map((col, cIdx) => {
                const Icon = getTypeIcon(col.type);
                const isSorted = sortColumnId === col.id;
                const isResizingThis = resizingColId === col.id;

                const headerStyle: React.CSSProperties = {
                  width: `${col.width || 160}px`,
                  minWidth: `${col.width || 160}px`,
                  backgroundColor: col.styling?.bgColor || undefined,
                  color: col.styling?.textColor || undefined,
                  fontWeight: col.styling?.bold ? 'bold' : '600',
                  fontStyle: col.styling?.italic ? 'italic' : 'normal',
                  textAlign: col.styling?.align || 'left',
                };

                return (
                  <th
                    key={col.id || `col-${cIdx}`}
                    style={headerStyle}
                    className="group relative border-r border-slate-300 p-2.5 transition select-none dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {/* Left: Type Icon & Name - Touch/Click opens Column Properties */}
                      <button
                        type="button"
                        onClick={() => setSelectedColForProps(col)}
                        className="flex flex-1 items-center gap-1.5 truncate text-left focus:outline-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Click to view and edit column properties"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate font-semibold">{col.name}</span>
                      </button>

                      {/* Header Dropdown Menu (3-dots button) - Always visible & touch-friendly */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveColMenuId(activeColMenuId === col.id ? null : col.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg p-1 text-slate-500 hover:bg-slate-200 active:bg-slate-300 dark:text-slate-400 dark:hover:bg-slate-700 dark:active:bg-slate-600 transition-colors"
                          title="Column menu (Rename, Change Type, Properties...)"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {/* Working Column Header Menu with all required options */}
                        {activeColMenuId === col.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-7 z-40 w-64 max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          >
                            {/* Header: Column Name & Back to Data */}
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                                Column: {col.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveColMenuId(null)}
                                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Close menu and back to table data"
                              >
                                <ArrowLeft className="h-3 w-3" />
                                <span>Back to Data</span>
                              </button>
                            </div>

                            {/* 1. Direct Rename */}
                            <button
                              id={`menu-rename-column-${col.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedColForRename(col);
                                setActiveColMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-amber-600" />
                              <span>Rename</span>
                            </button>

                            {/* 2. Change Type */}
                            <button
                              id={`menu-change-type-${col.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedColForType(col);
                                setActiveColMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Layers className="h-3.5 w-3.5 text-indigo-600" />
                              <span>Change Type</span>
                            </button>

                            {/* 3. Edit Column / Column Properties */}
                            <button
                              id={`menu-edit-column-${col.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedColForProps(col);
                                setActiveColMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Sliders className="h-3.5 w-3.5 text-blue-600" />
                              <span>Column Properties</span>
                            </button>

                            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                            {/* 4. Text Size ("move to menu Column text size changes in this") */}
                            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/60">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Text Size (የጽሑፍ መጠን)
                                </span>
                                <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                  {textSizeConfigs[currentTextSize]?.label} ({textSizeConfigs[currentTextSize]?.sizePx})
                                </span>
                              </div>
                              <div className="grid grid-cols-5 gap-1">
                                {textSizeOrder.map((key) => {
                                  const isSelected = key === currentTextSize;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => updateActiveTableRowTextSize(key)}
                                      className={`rounded py-1 text-[10px] font-bold transition cursor-pointer text-center ${
                                        isSelected
                                          ? 'bg-blue-600 text-white shadow-xs'
                                          : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                      }`}
                                      title={`${textSizeConfigs[key]?.label} (${textSizeConfigs[key]?.sizePx})`}
                                    >
                                      {key.toUpperCase()}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 5. Column & Row Colors */}
                            <div className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/60">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  <Palette className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                  <span>Colors (ቀለሞች)</span>
                                </span>
                                {selectedPaletteColor && (
                                  <span
                                    className="h-3.5 w-3.5 rounded border border-slate-300 shadow-2xs"
                                    style={{ backgroundColor: selectedPaletteColor }}
                                    title="Selected swatch"
                                  />
                                )}
                              </div>

                              {/* Palette Swatches */}
                              <div className="flex flex-wrap items-center gap-1 mb-2">
                                {COLOR_PALETTE.map((cItem) => {
                                  const isSelected = selectedPaletteColor === cItem.hex;
                                  return (
                                    <button
                                      key={cItem.name}
                                      type="button"
                                      onClick={() => setSelectedPaletteColor(cItem.hex)}
                                      style={{ backgroundColor: cItem.hex || '#ffffff' }}
                                      className={`h-5 w-5 rounded border transition-transform hover:scale-110 cursor-pointer ${
                                        isSelected
                                          ? 'ring-2 ring-blue-600 ring-offset-1 border-blue-600 dark:ring-offset-slate-900'
                                          : 'border-slate-300 dark:border-slate-600'
                                      }`}
                                      title={cItem.name}
                                    />
                                  );
                                })}
                                {/* Custom Color Picker */}
                                <label
                                  title="Pick custom color"
                                  className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-dashed border-slate-400 hover:border-slate-600 dark:border-slate-500"
                                >
                                  <Pipette className="h-2.5 w-2.5 text-slate-600 dark:text-slate-300" />
                                  <input
                                    type="color"
                                    value={selectedPaletteColor || '#3b82f6'}
                                    onChange={(e) => setSelectedPaletteColor(e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                </label>
                              </div>

                              {/* Apply Buttons Grid */}
                              <div className="grid grid-cols-2 gap-1 text-[10px]">
                                <button
                                  id={`btn-col-color-${col.id}`}
                                  type="button"
                                  onClick={() => handleApplyColorToColumn(col.id, selectedPaletteColor)}
                                  className="rounded bg-white border border-slate-200 px-1.5 py-1 font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition cursor-pointer"
                                  title="Set background color for this column"
                                >
                                  Set Column Color
                                </button>

                                <button
                                  id={`btn-all-cols-color-${col.id}`}
                                  type="button"
                                  onClick={() => handleApplyColorToAllColumns(selectedPaletteColor)}
                                  className="rounded bg-white border border-slate-200 px-1.5 py-1 font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition cursor-pointer"
                                  title="Set background color for all columns"
                                >
                                  Set All Columns
                                </button>

                                <button
                                  id={`btn-row-color-${col.id}`}
                                  type="button"
                                  onClick={() => handleApplyColorToRow(selectedPaletteColor)}
                                  className="rounded bg-white border border-slate-200 px-1.5 py-1 font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition cursor-pointer"
                                  title="Set background color for active row"
                                >
                                  Set Row Color
                                </button>

                                <button
                                  id={`btn-all-rows-color-${col.id}`}
                                  type="button"
                                  onClick={() => handleApplyColorToAllRows(selectedPaletteColor)}
                                  className="rounded bg-white border border-slate-200 px-1.5 py-1 font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition cursor-pointer"
                                  title="Set background color for all rows"
                                >
                                  Set All Rows
                                </button>
                              </div>

                              {/* SAVE COLOR & RETURN TO DATA / SET BACK (Direct User Request) */}
                              <div className="mt-2 space-y-1 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80">
                                <button
                                  id={`btn-save-col-color-done-${col.id}`}
                                  type="button"
                                  onClick={async () => {
                                    await handleApplyColorToColumn(col.id, selectedPaletteColor);
                                    setActiveColMenuId(null);
                                  }}
                                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                                  title="Save column background color and return to table data"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                  <span>Save Color & Back to Data</span>
                                </button>

                                <div className="grid grid-cols-2 gap-1">
                                  <button
                                    id={`btn-setback-col-color-${col.id}`}
                                    type="button"
                                    onClick={async () => {
                                      await handleApplyColorToColumn(col.id, '');
                                      setActiveColMenuId(null);
                                    }}
                                    className="flex items-center justify-center gap-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-1.5 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                                    title="Set back column data color to default"
                                  >
                                    <RotateCcw className="h-2.5 w-2.5 text-slate-500" />
                                    <span>Set Back Default</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setActiveColMenuId(null)}
                                    className="flex items-center justify-center gap-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-1.5 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                                    title="Back to table data"
                                  >
                                    <ArrowLeft className="h-2.5 w-2.5 text-slate-500" />
                                    <span>Back to Data</span>
                                  </button>
                                </div>
                              </div>

                              {/* Set All Rows & Cols + Clear */}
                              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleApplyColorToAllTable(selectedPaletteColor)}
                                  className="font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                                  title="Apply color to all rows and columns"
                                >
                                  Set All Rows & Cols
                                </button>
                                <button
                                  type="button"
                                  onClick={handleClearAllColors}
                                  className="flex items-center gap-0.5 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                                  title="Clear all background colors"
                                >
                                  <RotateCcw className="h-2.5 w-2.5" />
                                  <span>Clear Colors</span>
                                </button>
                              </div>
                            </div>

                            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                            {/* 6. Insert Column Left */}
                            <button
                              id={`menu-insert-left-${col.id}`}
                              type="button"
                              onClick={() => handleInsertColumnLeft(col)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Insert Column Left</span>
                            </button>

                            {/* 7. Insert Column Right */}
                            <button
                              id={`menu-insert-right-${col.id}`}
                              type="button"
                              onClick={() => handleInsertColumnRight(col)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Insert Column Right</span>
                            </button>

                            {/* 8. Duplicate Column */}
                            <button
                              id={`menu-duplicate-column-${col.id}`}
                              type="button"
                              onClick={() => handleDuplicateColumn(col.id)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5 text-teal-600" />
                              <span>Duplicate Column</span>
                            </button>

                            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                            {/* 9. Move Left */}
                            <button
                              type="button"
                              disabled={cIdx === 0}
                              onClick={() => handleMoveColumn(col.id, 'left')}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <MoveLeft className="h-3.5 w-3.5 text-slate-500" />
                              <span>Move Left</span>
                            </button>

                            {/* 10. Move Right */}
                            <button
                              type="button"
                              disabled={cIdx === columns.length - 1}
                              onClick={() => handleMoveColumn(col.id, 'right')}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <MoveRight className="h-3.5 w-3.5 text-slate-500" />
                              <span>Move Right</span>
                            </button>

                            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                            {/* 11. Delete Column with Safety Dialog */}
                            <button
                              id={`menu-delete-column-${col.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedColForDelete(col);
                                setActiveColMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Column</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right-edge Drag Handle for Direct Column Resizing */}
                    <div
                      onMouseDown={(e) => startColumnResize(e, col)}
                      className="absolute right-0 top-0 h-full w-2.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors"
                      title="Drag to resize column"
                    />

                    {/* Resizing Live Tooltip Indicator */}
                    {isResizingThis && resizingWidth !== null && (
                      <div className="absolute right-0 top-full mt-1 z-50 rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-lg pointer-events-none whitespace-nowrap">
                        Width: {resizingWidth} px
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* SPREADSHEET ROWS */}
          <tbody className={currentTextConfig.fontSize}>
            {displayRows.map((row, rIdx) => {
              const rowBg = row.styling?.bgColor;
              const rowColor = row.styling?.textColor;
              const isSelectedRow = selectedRowId === row.id;

              return (
                <tr
                  key={row.id || `row-${rIdx}`}
                  onClick={() => {
                    setSelectedRowId(row.id);
                    handleOpenWritePadForEditRow(row, lastActiveColId || (columns.length > 0 ? columns[0].id : undefined));
                  }}
                  style={{
                    backgroundColor: rowBg || undefined,
                  }}
                  className={`border-b border-slate-200 transition-colors hover:bg-blue-50/40 dark:border-slate-800/80 dark:hover:bg-blue-950/30 cursor-pointer ${
                    isSelectedRow ? 'ring-1 ring-blue-400/50' : ''
                  }`}
                  title={`Click row to directly show Box Pad for Row #${rIdx + 1}`}
                >
                  {/* Row Number Column & Row Write Pad Edit / Delete triggers (1-Click Row Edit) */}
                  {showRowNumbers && (
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRowId(row.id);
                        handleOpenWritePadForEditRow(row, lastActiveColId || (columns.length > 0 ? columns[0].id : undefined));
                      }}
                      style={{
                        backgroundColor: rowBg ? `${rowBg}ee` : undefined,
                      }}
                      className={`group relative w-16 border-r border-slate-200 bg-slate-50/50 ${currentTextConfig.cellPadding} text-center font-mono text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 select-none cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/40 ${
                        isSelectedRow ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/60' : ''
                      }`}
                      title={`Row #${rIdx + 1}. 1-Click to open Row Write Pad & edit row data`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold">{rIdx + 1}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWritePadForEditRow(row, lastActiveColId || (columns.length > 0 ? columns[0].id : undefined));
                          }}
                          className="rounded p-0.5 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-950 transition cursor-pointer"
                          title={`1-Click to edit Row #${rIdx + 1} in Write Pad`}
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRow(row.id);
                          }}
                          className="hidden group-hover:block rounded p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950 transition cursor-pointer"
                          title={`Delete row #${rIdx + 1}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  )}

                  {/* Cells */}
                  {columns.map((col, cIdx) => {
                    const cellKey = `${row.id}_${col.id}`;
                    const isEditing = editingCellKey === cellKey;
                    const rawVal = cells[cellKey];
                    const evaluatedVal = evaluatedCells[cellKey];
                    const cellBg = col.styling?.bgColor || rowBg;
                    const cellTextColor = col.styling?.textColor || rowColor;

                    return (
                      <td
                        key={`cell-${row.id}-${col.id || cIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(row.id, col, e);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleOpenWritePadForEditRow(row, col.id);
                        }}
                        style={{
                          width: `${col.width || 160}px`,
                          minWidth: `${col.width || 160}px`,
                          textAlign: col.styling?.align || 'left',
                          backgroundColor: cellBg || undefined,
                          color: cellTextColor || undefined,
                          fontWeight: col.styling?.bold ? 'bold' : 'normal',
                          fontStyle: col.styling?.italic ? 'italic' : 'normal',
                        }}
                        className={`relative border-r border-slate-200 ${currentTextConfig.cellPadding} ${currentTextConfig.fontSize} text-slate-800 transition-colors hover:bg-blue-50/50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-blue-950/40`}
                      >
                      {/* Checkbox cell */}
                      {col.type === 'checkbox' && (
                        <div className="flex items-center justify-center">
                          {rawVal ? (
                            <CheckSquare className={`${currentTextConfig.iconSize} text-blue-600`} />
                          ) : (
                            <Square className={`${currentTextConfig.iconSize} text-slate-300`} />
                          )}
                        </div>
                      )}

                      {/* Image cell */}
                      {col.type === 'image' && (
                        <div className="flex items-center gap-1.5">
                          {rawVal ? (
                            <img
                              src={rawVal}
                              alt="Cell"
                              className="h-7 w-7 rounded object-cover border border-slate-300 shadow-2xs"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No image</span>
                          )}
                        </div>
                      )}

                      {/* Select Dropdown cell */}
                      {col.type === 'select' && (
                        <div>
                          {isEditing ? (
                            <select
                              autoFocus
                              value={rawVal || ''}
                              onChange={(e) => {
                                updateCellDirectly(row.id, col.id, e.target.value);
                                setEditingCellKey(null);
                              }}
                              onBlur={() => setEditingCellKey(null)}
                              className={`w-full rounded border border-blue-500 bg-white ${currentTextConfig.inputPadding} focus:outline-none dark:bg-slate-900`}
                            >
                              <option value="">-- Select --</option>
                              {col.formatting?.selectOptions?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 font-semibold ${
                                rawVal
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {rawVal || '-'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Formula cell */}
                      {col.type === 'formula' && (
                        <div className={`font-mono ${currentTextConfig.fontSize} font-bold text-blue-700 dark:text-blue-300`}>
                          {formatCellValue(evaluatedVal, col, col.formatting?.currencySymbol)}
                        </div>
                      )}

                      {/* Standard Text / Number / Amount / Date Cells with AutoSuggest */}
                      {col.type !== 'checkbox' &&
                        col.type !== 'image' &&
                        col.type !== 'select' &&
                        col.type !== 'formula' && (
                          <div>
                            {isEditing ? (
                              <AutoSuggestInput
                                value={editInputVal}
                                onChange={(val) => setEditInputVal(val)}
                                onSelect={(val) => {
                                  updateCellDirectly(row.id, col.id, val);
                                  setEditingCellKey(null);
                                }}
                                onSave={() => handleCellSave(row.id, col.id)}
                                onBlur={() => handleCellCancel()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellSave(row.id, col.id);
                                  if (e.key === 'Escape') handleCellCancel();
                                }}
                                suggestions={columnSuggestionsMap[col.id] || EMPTY_SUGGESTIONS}
                                placeholder={
                                  isDateCol(col)
                                    ? 'e.g. 25/12/2018 (🇪🇹 Today)'
                                    : `Enter ${col.name}...`
                                }
                                autoFocus
                                onOpenWritePad={() => {
                                  handleCellCancel();
                                  handleOpenWritePadForEditRow(row, col.id);
                                }}
                                className={`w-full rounded border border-blue-500 bg-white ${currentTextConfig.inputPadding} text-slate-900 focus:outline-none dark:bg-slate-950 dark:text-white`}
                              />
                            ) : (
                              <div className="flex items-center justify-between group/cell w-full">
                                <span className="block truncate">
                                  {formatCellValue(rawVal, col, col.formatting?.currencySymbol)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenWritePadForEditRow(row, col.id);
                                  }}
                                  className="hidden group-hover/cell:flex items-center text-blue-500 hover:text-blue-700 opacity-60 hover:opacity-100 transition p-0.5 ml-1"
                                  title={`Open Row #${row.row_number} Write Box for ${col.name}`}
                                >
                                  <PenLine className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>

          {/* 3. SUMMARY ROW (Σ) */}
          <tfoot>
            <tr className={`border-t-2 border-slate-300 bg-slate-100 font-mono ${currentTextConfig.fontSize} font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100`}>
              {showRowNumbers && (
                <td className={`border-r border-slate-300 ${currentTextConfig.cellPadding} text-center text-blue-600 dark:border-slate-700 dark:text-blue-400`}>
                  Σ
                </td>
              )}
              {columns.map((col, cIdx) => {
                const summary = columnSummaries[col.id];
                return (
                  <td
                    key={`summary-${col.id || cIdx}`}
                    style={{
                      width: `${col.width || 160}px`,
                      minWidth: `${col.width || 160}px`,
                      textAlign: col.styling?.align || 'left',
                    }}
                    className={`border-r border-slate-300 ${currentTextConfig.cellPadding} dark:border-slate-700`}
                  >
                    {summary?.hasNumbers ? (
                      <div className="space-y-0.5">
                        <div className="text-blue-700 dark:text-blue-300">
                          {formatCellValue(summary.sum, col, col.formatting?.currencySymbol)}
                        </div>
                        <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                          Avg: {summary.avg}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-normal">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MODALS */}
      {/* 1. Column Properties Modal */}
      {selectedColForProps && (
        <ColumnPropertiesModal
          column={selectedColForProps}
          allColumns={columns}
          onClose={() => setSelectedColForProps(null)}
          onSave={handleSaveColumnProps}
          onDelete={async () => {
            const target = selectedColForProps;
            setSelectedColForProps(null);
            setSelectedColForDelete(target);
          }}
          onInsertLeft={async () => {
            if (!activeTable || !user) return;
            await dbService.insertColumnAt(
              activeTable.id,
              selectedColForProps.id,
              'left',
              { name: `Col ${columns.length + 1}`, type: 'text', width: 160 },
              user.id
            );
            const refreshed = await dbService.getTableDetail(activeTable.id, user.id);
            if (refreshed) {
              setColumns(refreshed.columns || []);
              setCells(refreshed.cells || {});
            }
            setSelectedColForProps(null);
          }}
          onInsertRight={async () => {
            if (!activeTable || !user) return;
            await dbService.insertColumnAt(
              activeTable.id,
              selectedColForProps.id,
              'right',
              { name: `Col ${columns.length + 1}`, type: 'text', width: 160 },
              user.id
            );
            const refreshed = await dbService.getTableDetail(activeTable.id, user.id);
            if (refreshed) {
              setColumns(refreshed.columns || []);
              setCells(refreshed.cells || {});
            }
            setSelectedColForProps(null);
          }}
        />
      )}

      {/* 2. Direct Rename Modal */}
      {selectedColForRename && (
        <ColumnRenameModal
          currentName={selectedColForRename.name}
          onClose={() => setSelectedColForRename(null)}
          onSave={handleDirectRename}
        />
      )}

      {/* 3. Column Delete Safety Modal */}
      {selectedColForDelete && (
        <ColumnDeleteModal
          columnName={selectedColForDelete.name}
          onClose={() => setSelectedColForDelete(null)}
          onConfirm={handleDeleteColumnConfirm}
        />
      )}

      {/* 4. Quick Change Column Type Dialog */}
      {selectedColForType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Change Column Type
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Select a new data type for "{selectedColForType.name}"
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { type: 'text', label: 'Text', icon: Type },
                { type: 'number', label: 'Number', icon: Hash },
                { type: 'amount', label: 'Amount (Birr)', icon: DollarSign },
                { type: 'date', label: 'Date', icon: Calendar },
                { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
                { type: 'select', label: 'Select List', icon: ChevronDown },
                { type: 'formula', label: 'Formula', icon: Cpu },
                { type: 'image', label: 'Image', icon: ImageIcon },
              ].map((item) => {
                const Icon = item.icon;
                const isCurrent = selectedColForType.type === item.type;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleChangeColumnType(item.type as ColumnType)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedColForType(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Cell Image Modal */}
      {imageModalConfig && (
        <CellImageModal
          currentUrl={imageModalConfig.url}
          onClose={() => setImageModalConfig(null)}
          onSave={async (url) => {
            await updateCellDirectly(imageModalConfig.rowId, imageModalConfig.columnId, url);
            setImageModalConfig(null);
          }}
        />
      )}

      {/* 6. Version History Modal */}
      {showVersionHistory && (
        <VersionHistoryModal
          tableId={activeTable.id}
          tableName={activeTable.name}
          onClose={() => setShowVersionHistory(false)}
          onRestore={async () => {
            await refreshActiveTable();
            setShowVersionHistory(false);
          }}
        />
      )}

      {/* 7. Backups Modal */}
      {showBackups && (
        <BackupModal
          tableId={activeTable.id}
          onClose={() => setShowBackups(false)}
        />
      )}

      {/* 8. Excel Import Modal */}
      {showImportModal && (
        <ExcelImportModal
          tableId={activeTable.id}
          onClose={() => setShowImportModal(false)}
          onImportComplete={async () => {
            await refreshActiveTable();
            setShowImportModal(false);
          }}
        />
      )}

      {/* 9. Row Write Pad Panel */}
      {isWritePadOpen && (
        <RowWritePad
          isOpen={isWritePadOpen}
          onClose={() => {
            setIsWritePadOpen(false);
            setWritePadEditingRow(null);
            setWritePadInitialColId(undefined);
          }}
          table={activeTable}
          columns={columns}
          rows={rows}
          cells={cells}
          editingRow={writePadEditingRow}
          initialColumnId={writePadInitialColId}
          onSaveRow={handleSaveRowFromPad}
          onOpenRowForEdit={(row) => {
            setWritePadEditingRow(row);
          }}
          onAddColumn={handleAddColumn}
        />
      )}
    </div>
  );
};
