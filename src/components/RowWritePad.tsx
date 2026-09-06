import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Plus,
  SlidersHorizontal,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { TableColumn, TableRow, SpreadsheetTable } from '../types';
import { getTodayEthiopian } from '../lib/ethiopianCalendar';

const DEFAULT_WRITE_PAD_COLUMNS: TableColumn[] = [
  { id: 'col_default', table_id: '', user_id: '', name: 'Notes', type: 'text', width: 180, position: 0, created_at: '' }
];

interface RowWritePadProps {
  isOpen: boolean;
  onClose: () => void;
  table: SpreadsheetTable;
  columns: TableColumn[];
  rows: TableRow[];
  cells: Record<string, any>;
  editingRow?: TableRow | null; // null if inserting new row
  initialColumnId?: string;
  onSaveRow: (
    cellValues: Record<string, any>,
    mode: 'INSERT' | 'EDIT',
    targetRowId?: string
  ) => Promise<{ success: boolean; saveTime: string; rowNumber: number }>;
  onOpenRowForEdit?: (row: TableRow) => void;
  onAddColumn?: () => Promise<void | TableColumn>;
}

export const RowWritePad: React.FC<RowWritePadProps> = ({
  isOpen,
  onClose,
  table: _table,
  columns,
  rows,
  cells,
  editingRow,
  initialColumnId,
  onSaveRow,
  onAddColumn,
}) => {
  // Internal state tracking whether we are editing an existing row or inserting new
  const [currentEditingRow, setCurrentEditingRow] = useState<TableRow | null>(editingRow || null);
  const [currentRowNum, setCurrentRowNum] = useState<number>(
    editingRow ? editingRow.row_number || 1 : rows.length + 1
  );
  const [saveToastMsg, setSaveToastMsg] = useState<string | null>(null);

  // View mode: defaults to 'single' so clicking in row shows that column pad box only
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

  // Selected column index to write/edit
  const [activeColIndex, setActiveColIndex] = useState<number>(0);

  // Form values for all columns of this row
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingCol, setIsAddingCol] = useState(false);

  // Voice speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [listeningColId, setListeningColId] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const columnInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Filter columns that are editable (skip formulas)
  const editableColumns = useMemo(() => {
    return columns && columns.length > 0 ? columns : DEFAULT_WRITE_PAD_COLUMNS;
  }, [columns]);

  const editingRowId = editingRow?.id;
  const initialColId = initialColumnId;

  // Sync internal editing state when opening or when active target row changes
  useEffect(() => {
    if (!isOpen) return;

    setCurrentEditingRow(editingRow || null);
    setCurrentRowNum(editingRow ? editingRow.row_number || 1 : rows.length + 1);

    // Show that clicked column pad box only by default
    setViewMode('single');

    // Set active column index
    if (initialColId) {
      const cleanTarget = String(initialColId).trim().toLowerCase();
      const idx = editableColumns.findIndex(
        (c) => c.id === initialColId || (c.name && c.name.trim().toLowerCase() === cleanTarget)
      );
      setActiveColIndex(idx >= 0 ? idx : 0);
    } else {
      setActiveColIndex(0);
    }

    // Populate data
    if (editingRow) {
      const initial: Record<string, any> = {};
      editableColumns.forEach((col) => {
        const val = cells[`${editingRow.id}_${col.id}`];
        initial[col.id] = val !== undefined ? val : '';
      });
      setFormData(initial);
    } else {
      // Blank new row defaults
      const blank: Record<string, any> = {};
      editableColumns.forEach((col) => {
        if (col.type === 'checkbox') blank[col.id] = false;
        else if (col.type === 'date') blank[col.id] = new Date().toISOString().split('T')[0];
        else blank[col.id] = '';
      });
      setFormData(blank);
    }

    // Focus input after opening
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen, editingRowId, initialColId]);

  // Current active column
  const currentColumn = editableColumns[activeColIndex] || editableColumns[0];
  const currentColumnRef = useRef(currentColumn);
  currentColumnRef.current = currentColumn;

  const listeningColIdRef = useRef(listeningColId);
  listeningColIdRef.current = listeningColId;

  const currentValue = currentColumn && formData[currentColumn.id] !== undefined ? String(formData[currentColumn.id]) : '';

  // Check if current column is date
  const isDateCol = React.useMemo(() => {
    if (!currentColumn) return false;
    const name = (currentColumn.name || '').toLowerCase();
    return (
      currentColumn.type === 'date' ||
      name.includes('date') ||
      name.includes('ቀን') ||
      name.includes('ken')
    );
  }, [currentColumn]);

  // Check column type for helper rendering
  const isNumberOrAmountCol = React.useMemo(() => {
    if (!currentColumn) return false;
    const name = (currentColumn.name || '').toLowerCase();
    return (
      currentColumn.type === 'number' ||
      currentColumn.type === 'amount' ||
      name.includes('amunt') ||
      name.includes('amount') ||
      name.includes('price') ||
      name.includes('qty') ||
      name.includes('quantity') ||
      name.includes('total') ||
      name.includes('count') ||
      name.includes('birr') ||
      name.includes('ዋጋ') ||
      name.includes('ድምር')
    );
  }, [currentColumn]);

  // Speech recognition setup (initialized once)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        const targetColId = listeningColIdRef.current || currentColumnRef.current?.id;
        if (transcript && targetColId) {
          setFormData((prev) => ({
            ...prev,
            [targetColId]: transcript,
          }));
        }
        setIsListening(false);
        setListeningColId(null);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition notice:', e?.error);
        setIsListening(false);
        setListeningColId(null);
      };

      recognition.onend = () => {
        setIsListening(false);
        setListeningColId(null);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Could not initialize SpeechRecognition:', e);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleVoiceInput = (colId?: string) => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setListeningColId(null);
    } else {
      try {
        const targetId = colId || currentColumn?.id || null;
        setListeningColId(targetId);
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
      }
    }
  };

  const handleInputChange = (val: any, colId?: string) => {
    const targetColId = colId || currentColumn?.id;
    if (!targetColId) return;
    setFormData((prev) => ({
      ...prev,
      [targetColId]: val,
    }));
  };

  // Quick timestamp helpers ("write time box writer fil am save method")
  const insertCurrentTime = (colId?: string) => {
    const targetColId = colId || currentColumn?.id;
    if (!targetColId) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setFormData((prev) => ({
      ...prev,
      [targetColId]: timeStr,
    }));
    inputRef.current?.focus();
  };

  const insertCurrentDateTime = (colId?: string) => {
    const targetColId = colId || currentColumn?.id;
    if (!targetColId) return;
    const now = new Date();
    const dtStr = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setFormData((prev) => ({
      ...prev,
      [targetColId]: dtStr,
    }));
    inputRef.current?.focus();
  };

  const insertTodayDate = (colId?: string, forceEthiopian?: boolean) => {
    const targetColId = colId || currentColumn?.id;
    if (!targetColId) return;
    const col = editableColumns.find((c) => c.id === targetColId);
    let dateStr = new Date().toISOString().split('T')[0];
    if (forceEthiopian || col?.formatting?.calendarSystem === 'ethiopian') {
      try {
        const eth = getTodayEthiopian();
        dateStr = eth.formattedSlash; // e.g. "25/12/2018"
      } catch {}
    }
    setFormData((prev) => ({
      ...prev,
      [targetColId]: dateStr,
    }));
    inputRef.current?.focus();
  };

  // Quick number adjuster
  const adjustNumberValue = (delta: number, colId?: string) => {
    const targetColId = colId || currentColumn?.id;
    if (!targetColId) return;
    const currentNum = parseFloat(formData[targetColId]) || 0;
    const nextNum = Math.max(0, currentNum + delta);
    handleInputChange(String(nextNum), targetColId);
    inputRef.current?.focus();
  };

  // Previous suggestions for this column
  const columnSuggestions = React.useMemo(() => {
    if (!currentColumn) return [];
    const set = new Set<string>();
    rows.forEach((r) => {
      const v = cells[`${r.id}_${currentColumn.id}`];
      if (v !== undefined && v !== null && String(v).trim()) {
        set.add(String(v).trim());
      }
    });
    if (currentColumn.formatting?.selectOptions) {
      currentColumn.formatting.selectOptions.forEach((opt) => {
        if (opt?.trim()) set.add(opt.trim());
      });
    }
    return Array.from(set).slice(0, 6);
  }, [currentColumn, rows, cells]);

  // Save row logic
  const handleSave = async (andNextRow: boolean = false) => {
    setIsSaving(true);
    try {
      const mode = currentEditingRow ? 'EDIT' : 'INSERT';
      const targetRowId = currentEditingRow?.id;
      const res = await onSaveRow(formData, mode, targetRowId);

      if (res.success) {
        if (andNextRow) {
          // Prepare blank for next row
          const blank: Record<string, any> = {};
          editableColumns.forEach((col) => {
            if (col.type === 'checkbox') blank[col.id] = false;
            else if (col.type === 'date') blank[col.id] = new Date().toISOString().split('T')[0];
            else blank[col.id] = '';
          });
          setFormData(blank);
          setCurrentEditingRow(null); // Advance to subsequent new row insertion
          setCurrentRowNum((prev) => prev + 1);
          setActiveColIndex(0);
          setSaveToastMsg(`Row #${currentRowNum} saved! Ready for Row #${currentRowNum + 1}`);
          setTimeout(() => setSaveToastMsg(null), 2500);
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }, 80);
        } else {
          onClose();
        }
      }
    } catch (err) {
      console.error('Failed to save row:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const goToPrevColumn = () => {
    if (activeColIndex > 0) {
      setActiveColIndex(activeColIndex - 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const goToNextColumn = () => {
    if (activeColIndex < editableColumns.length - 1) {
      setActiveColIndex(activeColIndex + 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-table-notes-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="modal-table-notes-dialog"
        className={`w-full ${
          viewMode === 'single' ? 'max-w-[480px] min-h-[350px]' : 'max-w-[460px] sm:max-w-xl md:max-w-2xl lg:max-w-3xl min-h-[460px]'
        } rounded-3xl bg-white p-5 sm:p-6 shadow-2xl transition-all duration-200 dark:bg-slate-900 dark:border dark:border-slate-800 animate-in fade-in zoom-in-95 flex flex-col my-auto max-h-[92vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Save Toast Notification */}
        {saveToastMsg && (
          <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-200 flex items-center gap-1.5 animate-in fade-in shrink-0">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span>{saveToastMsg}</span>
          </div>
        )}

        {/* TOP BAR: COLUMN TITLE, ADD COLUMN, VIEW MODE TOGGLE & MICROPHONE */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="min-w-0 pr-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {viewMode === 'all' ? 'All Column Rows in Pad' : `${currentColumn?.name || 'Column'} Pad Box`}
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
              {viewMode === 'all' ? `Row #${currentRowNum} All Columns` : currentColumn?.name || 'Notes'}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Row #{currentRowNum}
              </span>
              {currentEditingRow ? (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  (Editing Row)
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  (Create New Row)
                </span>
              )}
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                • Unsaved data is not written to row
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Add Column Button inside Write Pad */}
            {onAddColumn && (
              <button
                id="btn-padbox-add-column"
                type="button"
                onClick={async () => {
                  setIsAddingCol(true);
                  try {
                    await onAddColumn();
                    setSaveToastMsg('New column created in table!');
                    setTimeout(() => setSaveToastMsg(null), 2500);
                  } finally {
                    setIsAddingCol(false);
                  }
                }}
                disabled={isAddingCol}
                className="flex items-center gap-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 text-xs font-bold dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 transition cursor-pointer disabled:opacity-50"
                title="Create a new column in this table"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isAddingCol ? 'Adding...' : 'Add Col'}</span>
              </button>
            )}

            {/* View Mode Toggle Button */}
            <button
              id="btn-toggle-view-mode"
              type="button"
              onClick={() => setViewMode(viewMode === 'single' ? 'all' : 'single')}
              className="flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
              title={viewMode === 'single' ? 'View all columns of this row at once' : 'Switch to single column focus'}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px]">{viewMode === 'single' ? 'All Fields' : 'Single'}</span>
            </button>

            {/* Voice Microphone Button */}
            <button
              id="btn-voice-microphone"
              type="button"
              onClick={() => toggleVoiceInput()}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all cursor-pointer ${
                isListening && !listeningColId
                  ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-200 shadow-md'
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-800/80'
              }`}
              title={
                speechSupported
                  ? isListening
                    ? 'Listening... Click to stop voice input'
                    : 'Click to speak (Voice to text)'
                  : 'Voice input not supported in this browser'
              }
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ALL-COLUMNS HORIZONTAL SELECTOR PILLS */}
        {editableColumns.length > 1 && (
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-2">
            {editableColumns.map((col, cIdx) => {
              const isColActive = cIdx === activeColIndex && viewMode === 'single';
              const colVal = formData[col.id];
              const hasVal = colVal !== undefined && colVal !== null && colVal !== '';
              return (
                <button
                  key={col.id || cIdx}
                  type="button"
                  onClick={() => {
                    setViewMode('single');
                    setActiveColIndex(cIdx);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className={`flex items-center gap-1 shrink-0 rounded-full px-2.5 py-1 text-xs transition cursor-pointer ${
                    isColActive
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : hasVal
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                  title={`Click to edit column '${col.name}'`}
                >
                  <span>{col.name}:</span>
                  <span className="max-w-[70px] truncate font-mono text-[11px] opacity-90">
                    {hasVal ? String(colVal) : 'empty'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* MAIN BODY: EITHER SINGLE FIELD FOCUS OR ALL FIELDS VIEW */}
        {viewMode === 'single' ? (
          /* SINGLE FIELD FOCUS VIEW - Input box is ALWAYS visible and prominent */
          <div className="flex-1 flex flex-col justify-between py-1 min-h-[260px]">
            <div>
              {/* PRIMARY WRITE BOX INPUT (Prominent, always rendered, with attached Save button) */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    id="input-table-notes-field"
                    type={currentColumn?.type === 'number' ? 'number' : 'text'}
                    value={currentValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.shiftKey || e.ctrlKey) {
                          handleSave(true);
                        } else if (activeColIndex < editableColumns.length - 1) {
                          goToNextColumn();
                        } else {
                          handleSave(false);
                        }
                      }
                      if (e.key === 'Escape') onClose();
                    }}
                    placeholder={`Enter ${currentColumn?.name || 'value'}...`}
                    className="h-12 w-full rounded-2xl border-2 border-blue-500 bg-white px-4 pr-10 text-base font-bold text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-3 focus:ring-blue-400/30 dark:border-blue-400 dark:bg-slate-950 dark:text-white"
                  />
                  {currentValue && (
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange('');
                        inputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200/80 hover:bg-rose-100 hover:text-rose-600 text-slate-500 transition cursor-pointer dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                      title="Clear input"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Direct Save Button on the Write Pad Box itself */}
                <button
                  id="btn-single-cell-box-save"
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="flex h-12 items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 text-sm font-bold shadow-md transition cursor-pointer shrink-0 disabled:opacity-50"
                  title={`Save Row #${currentRowNum}`}
                >
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>Save</span>
                </button>
              </div>

              {/* Quick Action Chips: Date chips shown only for date columns; time, Date & Time, and date picker removed */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {isDateCol && (
                  <>
                    {/* 1. Today Date (Gregorian) */}
                    <button
                      type="button"
                      onClick={() => insertTodayDate()}
                      className="flex items-center gap-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 transition cursor-pointer"
                      title="Insert today's Gregorian date (YYYY-MM-DD)"
                    >
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Today Date</span>
                    </button>

                    {/* 2. Today (E.C. / ኢ.ት) Ethiopian Calendar */}
                    <button
                      type="button"
                      onClick={() => insertTodayDate(undefined, true)}
                      className="flex items-center gap-1 rounded-full bg-slate-100 hover:bg-amber-50 hover:text-amber-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950 dark:hover:text-amber-300 transition cursor-pointer"
                      title="Insert today's Ethiopian calendar date (DD/MM/YYYY E.C.)"
                    >
                      <Calendar className="h-3.5 w-3.5 text-amber-600" />
                      <span>Today (E.C. / ኢ.ት)</span>
                    </button>
                  </>
                )}

                {/* Quick numeric adjusters if number column */}
                {isNumberOrAmountCol && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustNumberValue(-10)}
                      className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      title="Subtract 10"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustNumberValue(-1)}
                      className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      title="Subtract 1"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustNumberValue(1)}
                      className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      title="Add 1"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustNumberValue(10)}
                      className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      title="Add 10"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustNumberValue(100)}
                      className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      title="Add 100"
                    >
                      +100
                    </button>
                  </div>
                )}
              </div>

              {/* Checkbox column special toggle button */}
              {currentColumn?.type === 'checkbox' && (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !formData[currentColumn.id];
                      handleInputChange(nextVal);
                    }}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl p-3 font-bold transition cursor-pointer ${
                      formData[currentColumn.id]
                        ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 border-2 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {formData[currentColumn.id] ? (
                      <>
                        <CheckSquare className="h-5 w-5 text-emerald-600" />
                        <span>Checked (Yes / True)</span>
                      </>
                    ) : (
                      <>
                        <Square className="h-5 w-5 text-slate-400" />
                        <span>Unchecked (No / False)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Select Column Option Pills */}
              {currentColumn?.type === 'select' && currentColumn.formatting?.selectOptions && (
                <div className="mb-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Select Option:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentColumn.formatting.selectOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          handleInputChange(opt);
                          inputRef.current?.focus();
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                          formData[currentColumn.id] === opt
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* COLUMN SUGGESTIONS PILLS */}
              {columnSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mr-1">
                    Pick:
                  </span>
                  {columnSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        handleInputChange(sug);
                        inputRef.current?.focus();
                      }}
                      className="rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-2.5 py-0.5 text-xs text-slate-700 transition cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* MULTI-COLUMN STEPPER */}
            {editableColumns.length > 1 && (
              <div className="mt-2 mb-2 flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-1.5">
                <button
                  type="button"
                  disabled={activeColIndex === 0}
                  onClick={goToPrevColumn}
                  className="flex items-center gap-0.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Prev Col</span>
                </button>

                {/* Micro Column Dots/Pills */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-[150px] no-scrollbar px-1">
                  {editableColumns.map((col, cIdx) => (
                    <button
                      key={col.id || cIdx}
                      type="button"
                      onClick={() => {
                        setActiveColIndex(cIdx);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        cIdx === activeColIndex
                          ? 'w-5 bg-blue-600'
                          : formData[col.id]
                          ? 'w-2 bg-emerald-500'
                          : 'w-2 bg-slate-300 dark:bg-slate-600'
                      }`}
                      title={`${col.name} (${cIdx + 1})`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={activeColIndex >= editableColumns.length - 1}
                  onClick={goToNextColumn}
                  className="flex items-center gap-0.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <span>Next Col</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ALL FIELDS IN ROW VIEW (Allows editing all column rows simultaneously inside the pad box) */
          <div className="flex-1 min-h-[260px] max-h-[58vh] overflow-y-auto pr-1.5 space-y-3 mb-3 py-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
              <span>All {editableColumns.length} column rows in this pad box for <b>Row #{currentRowNum}</b>:</span>
              <span className="text-[11px] text-slate-400 font-normal">Press Enter to jump to next column</span>
            </div>

            {editableColumns.map((col, idx) => {
              const colVal = formData[col.id] !== undefined ? String(formData[col.id]) : '';
              const isDate =
                col.type === 'date' ||
                (col.name || '').toLowerCase().includes('date') ||
                (col.name || '').toLowerCase().includes('time') ||
                (col.name || '').toLowerCase().includes('ቀን');
              const isNumber =
                col.type === 'number' ||
                (col.name || '').toLowerCase().includes('amount') ||
                (col.name || '').toLowerCase().includes('price') ||
                (col.name || '').toLowerCase().includes('qty') ||
                (col.name || '').toLowerCase().includes('total');

              return (
                <div
                  key={col.id || idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        {idx + 1}
                      </span>
                      <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{col.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal capitalize bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {col.type}
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isDate && (
                        <>
                          <button
                            type="button"
                            onClick={() => insertTodayDate(col.id)}
                            className="flex items-center gap-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 transition cursor-pointer"
                            title="Insert today's Gregorian date (YYYY-MM-DD)"
                          >
                            <Calendar className="h-3 w-3 text-emerald-600" />
                            <span>Today</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTodayDate(col.id, true)}
                            className="flex items-center gap-1 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300 transition cursor-pointer"
                            title="Insert today's Ethiopian calendar date (E.C.)"
                          >
                            <Calendar className="h-3 w-3 text-amber-600" />
                            <span>ኢ.ት (E.C.)</span>
                          </button>
                        </>
                      )}

                      {/* Column microphone button */}
                      {speechSupported && (
                        <button
                          type="button"
                          onClick={() => toggleVoiceInput(col.id)}
                          className={`flex h-6 w-6 items-center justify-center rounded-full transition cursor-pointer ${
                            isListening && listeningColId === col.id
                              ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-300'
                              : 'bg-slate-200/80 hover:bg-blue-100 text-slate-600 hover:text-blue-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                          title={`Voice speak into ${col.name}`}
                        >
                          <Mic className="h-3 w-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={isSaving}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                        title={`Save all column data for Row #${currentRowNum}`}
                      >
                        <Check className="h-3 w-3 stroke-[2.5]" />
                        <span>Save Row</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      {col.type === 'checkbox' ? (
                        <button
                          type="button"
                          onClick={() => handleInputChange(!formData[col.id], col.id)}
                          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer w-full transition ${
                            formData[col.id]
                              ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-white text-slate-600 border-2 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          {formData[col.id] ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400" />
                          )}
                          <span>{formData[col.id] ? 'Checked (Yes)' : 'Unchecked (No)'}</span>
                        </button>
                      ) : col.type === 'select' && col.formatting?.selectOptions ? (
                        <select
                          value={colVal}
                          onChange={(e) => handleInputChange(e.target.value, col.id)}
                          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                          <option value="">-- Select {col.name} --</option>
                          {col.formatting.selectOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            ref={(el) => {
                              columnInputRefs.current[col.id] = el;
                            }}
                            type={col.type === 'number' ? 'number' : 'text'}
                            value={colVal}
                            onChange={(e) => handleInputChange(e.target.value, col.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (idx < editableColumns.length - 1) {
                                  columnInputRefs.current[editableColumns[idx + 1].id]?.focus();
                                } else {
                                  handleSave(false);
                                }
                              }
                            }}
                            placeholder={`Enter ${col.name}...`}
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-xs font-medium text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          {colVal && (
                            <button
                              type="button"
                              onClick={() => {
                                handleInputChange('', col.id);
                                columnInputRefs.current[col.id]?.focus();
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200/80 hover:bg-rose-100 hover:text-rose-600 text-slate-500 transition cursor-pointer dark:bg-slate-800 dark:text-slate-400"
                              title="Clear input"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Numeric quick adjusters if number column */}
                    {isNumber && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => adjustNumberValue(-1, col.id)}
                          className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 px-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                          title="Subtract 1"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustNumberValue(1, col.id)}
                          className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 px-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                          title="Add 1"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustNumberValue(10, col.id)}
                          className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 px-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                          title="Add 10"
                        >
                          +10
                        </button>
                      </div>
                    )}

                    {/* Direct Save Button for this column row */}
                    <button
                      type="button"
                      onClick={() => handleSave(false)}
                      disabled={isSaving}
                      className="flex h-10 items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 text-xs font-bold shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                      title={`Save this cell & Row #${currentRowNum}`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS (Cancel, Save Row, Save & Create Next Row) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            id="btn-table-notes-cancel"
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer text-center"
            title="Cancel and discard changes (Unsaved data is not written to row)"
          >
            Cancel (Discard)
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Primary Save Button */}
            <button
              id="btn-table-notes-save"
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-2 text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
              title={`Save all column rows for Row #${currentRowNum}`}
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>Save Row</span>
                </>
              )}
            </button>

            {/* Save & Create Next Row */}
            <button
              id="btn-table-notes-save-insert-row"
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2 text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
              title={`Save Row #${currentRowNum} and create next row in pad box`}
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span className="whitespace-nowrap">Save & Create Next</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
