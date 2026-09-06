import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  FolderPlus,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Hash,
  Type,
  CheckSquare,
  List,
  Cpu,
  Image as ImageIcon,
  Sparkles,
  Lock,
  Layers,
  Folder,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TableColumn, ColumnType, DateFormatType } from '../types';
import { getTodayEthiopian } from '../lib/ethiopianCalendar';

interface CustomColDef {
  id: string;
  name: string;
  type: ColumnType;
  calendarSystem?: 'ethiopian' | 'gregorian';
  dateFormat?: DateFormatType;
  formula?: string;
  selectOptions?: string;
}

export const CreateTableModal: React.FC = () => {
  const {
    isCreateTableModalOpen,
    closeCreateTableModal,
    createTableInitialFolder,
    createNewTable,
    tables,
    setTablePassword,
  } = useApp();

  const [tableName, setTableName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>(createTableInitialFolder || '');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Creation Mode: 'business' | 'blank' | 'manual'
  const [creationMode, setCreationMode] = useState<'business' | 'blank' | 'manual'>('blank');

  // Manual Columns list
  const [manualColumns, setManualColumns] = useState<CustomColDef[]>([
    { id: '1', name: 'Item / Description', type: 'text' },
    { id: '2', name: 'Amount (ETB)', type: 'amount' },
    {
      id: '3',
      name: 'Date (Ethiopian)',
      type: 'date',
      calendarSystem: 'ethiopian',
      dateFormat: 'ethiopian_dd_mm_yyyy',
    },
    { id: '4', name: 'Status', type: 'select', selectOptions: 'Paid, Pending, Verified' },
  ]);

  // Security
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCreateTableModalOpen) {
      setSelectedFolder(createTableInitialFolder || '');
      setIsCreatingNewFolder(false);
      setNewFolderName('');
      setTableName('');
      setError(null);
      setEnablePassword(false);
      setPassword('');
      setPasswordHint('');
    }
  }, [isCreateTableModalOpen, createTableInitialFolder]);

  // Extract existing unique folder names from tables
  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    for (const t of tables) {
      if (t.folder_name && t.folder_name.trim()) {
        set.add(t.folder_name.trim());
      }
    }
    return Array.from(set).sort();
  }, [tables]);

  if (!isCreateTableModalOpen) return null;

  const handleAddManualColumn = () => {
    const newIdx = manualColumns.length + 1;
    setManualColumns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Column ${newIdx}`,
        type: 'text',
      },
    ]);
  };

  const handleUpdateManualColumn = (id: string, updates: Partial<CustomColDef>) => {
    setManualColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, ...updates } : col))
    );
  };

  const handleRemoveManualColumn = (id: string) => {
    if (manualColumns.length <= 1) {
      setError('A table must have at least one column.');
      return;
    }
    setManualColumns((prev) => prev.filter((col) => col.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = tableName.trim();
    const finalFolder = isCreatingNewFolder
      ? newFolderName.trim()
      : selectedFolder.trim();

    setIsSubmitting(true);
    try {
      let createdTable;

      if (creationMode === 'blank') {
        // 1-Click Blank Table with clean editable starter columns
        createdTable = await createNewTable(
          cleanName || 'Blank Spreadsheet',
          undefined,
          finalFolder || undefined,
          true
        );
      } else if (creationMode === 'business') {
        // Business template with Birr A, Paid A, Total A, Date (EC), Status, Image
        createdTable = await createNewTable(
          cleanName || 'Business Spreadsheet',
          undefined,
          finalFolder || undefined,
          false
        );
      } else {
        // Manual Custom Columns
        const convertedCols: Partial<TableColumn>[] = manualColumns.map((c, idx) => ({
          name: c.name.trim() || `Column ${idx + 1}`,
          type: c.type,
          width: c.type === 'amount' || c.type === 'formula' ? 170 : 160,
          position: idx,
          formula: c.type === 'formula' ? c.formula : undefined,
          formatting: {
            numberFormat: c.type === 'amount' ? 'currency_etb' : undefined,
            calendarSystem: c.type === 'date' ? (c.calendarSystem || 'ethiopian') : undefined,
            dateFormat: c.type === 'date' ? (c.dateFormat || 'ethiopian_dd_mm_yyyy') : undefined,
            selectOptions:
              c.type === 'select' && c.selectOptions
                ? c.selectOptions.split(',').map((s) => s.trim()).filter(Boolean)
                : undefined,
          },
          styling: c.type === 'amount' ? { bold: true } : undefined,
        }));

        createdTable = await createNewTable(
          cleanName || 'Custom Spreadsheet',
          convertedCols,
          finalFolder || undefined,
          true
        );
      }

      if (enablePassword && password.trim() && createdTable) {
        await setTablePassword(createdTable.id, password.trim(), passwordHint, finalFolder || undefined);
      }

      closeCreateTableModal();
    } catch (err: any) {
      console.error('Create table error:', err);
      setError(err?.message || 'Failed to create spreadsheet table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columnTypeOptions: { type: ColumnType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { type: 'text', label: 'Text', icon: Type },
    { type: 'amount', label: 'Amount (ETB)', icon: DollarSign },
    { type: 'date', label: 'Date (Ethiopian / GC)', icon: Calendar },
    { type: 'number', label: 'Number', icon: Hash },
    { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { type: 'select', label: 'Dropdown', icon: List },
    { type: 'formula', label: 'Formula', icon: Cpu },
    { type: 'image', label: 'Image', icon: ImageIcon },
  ];

  return (
    <div
      id="modal-create-table-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="modal-create-table-card"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Create New Table / Spreadsheet
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set up blank sheet, business template, or configure columns manually
              </p>
            </div>
          </div>
          <button
            onClick={closeCreateTableModal}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          {/* 1. Table Name & Folder */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Table Name
              </label>
              <input
                id="input-create-table-name"
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="e.g. Sales Ledger 2018, Daily Expense"
                className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Folder / Workplace
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewFolder(!isCreatingNewFolder)}
                  className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {isCreatingNewFolder ? 'Choose Existing' : '+ New Folder'}
                </button>
              </div>

              {isCreatingNewFolder ? (
                <div className="relative">
                  <FolderPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter new folder name..."
                    className="h-10 w-full rounded-xl border border-blue-300 bg-blue-50/50 pl-9 pr-3 text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-blue-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Folder className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">No Folder (General Tables)</option>
                    {existingFolders.map((f) => (
                      <option key={f} value={f}>
                        📁 {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 2. Choose Creation Template / Mode */}
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Table Template & Layout
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {/* Option A: Blank Table */}
              <button
                type="button"
                id="btn-mode-blank"
                onClick={() => setCreationMode('blank')}
                className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
                  creationMode === 'blank'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <span className="mt-2 text-xs font-extrabold text-slate-900 dark:text-white">
                  Blank Table
                </span>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Clean starter table with blank rows & custom headers
                </p>
              </button>

              {/* Option B: Business Template */}
              <button
                type="button"
                id="btn-mode-business"
                onClick={() => setCreationMode('business')}
                className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
                  creationMode === 'business'
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="mt-2 text-xs font-extrabold text-slate-900 dark:text-white">
                  Business Template
                </span>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Birr A, Paid A, Total A [Formula], Date [🇪🇹], Status, Image
                </p>
              </button>

              {/* Option C: Set Manually */}
              <button
                type="button"
                id="btn-mode-manual"
                onClick={() => setCreationMode('manual')}
                className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
                  creationMode === 'manual'
                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20 dark:border-purple-500 dark:bg-purple-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="mt-2 text-xs font-extrabold text-slate-900 dark:text-white">
                  Set Columns Manually
                </span>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Configure custom column names, types & calendar formats
                </p>
              </button>
            </div>
          </div>

          {/* 3. Manual Column Builder (if creationMode === 'manual') */}
          {creationMode === 'manual' && (
            <div className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-900/40 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-purple-950 dark:text-purple-200">
                    Define Initial Columns
                  </span>
                  <p className="text-[11px] text-purple-700 dark:text-purple-400">
                    Add or modify columns before table creation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualColumn}
                  className="flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Column</span>
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {manualColumns.map((col, idx) => (
                  <div
                    key={col.id ? `manual-col-${col.id}` : `manual-col-${idx}`}
                    className="flex items-center gap-2 rounded-xl border border-purple-100 bg-white p-2 dark:border-purple-950 dark:bg-slate-950"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {idx + 1}
                    </span>

                    {/* Column Name */}
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => handleUpdateManualColumn(col.id, { name: e.target.value })}
                      placeholder="Column name"
                      className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />

                    {/* Column Type */}
                    <select
                      value={col.type}
                      onChange={(e) => {
                        const newType = e.target.value as ColumnType;
                        handleUpdateManualColumn(col.id, {
                          type: newType,
                          calendarSystem: newType === 'date' ? 'ethiopian' : undefined,
                          dateFormat: newType === 'date' ? 'ethiopian_dd_mm_yyyy' : undefined,
                        });
                      }}
                      className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {columnTypeOptions.map((opt) => (
                        <option key={opt.type} value={opt.type}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Date system selector if date */}
                    {col.type === 'date' && (
                      <select
                        value={col.calendarSystem || 'ethiopian'}
                        onChange={(e) =>
                          handleUpdateManualColumn(col.id, {
                            calendarSystem: e.target.value as 'ethiopian' | 'gregorian',
                            dateFormat:
                              e.target.value === 'ethiopian'
                                ? 'ethiopian_dd_mm_yyyy'
                                : 'gregorian_iso',
                          })
                        }
                        className="h-8 rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        <option value="ethiopian">🇪🇹 Ethiopian (25/12/2018)</option>
                        <option value="gregorian">🌐 Gregorian</option>
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveManualColumn(col.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Ethiopian Date Highlight Box */}
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🇪🇹</span>
              <div>
                <span className="font-bold text-emerald-950 dark:text-emerald-200">
                  Ethiopian Calendar Integrated
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Today is <span className="font-bold">{getTodayEthiopian().formattedAmharic}</span> (
                  <span className="font-mono font-bold">{getTodayEthiopian().formattedSlash}</span>)
                </p>
              </div>
            </div>
            <span className="rounded-lg bg-emerald-200/60 px-2.5 py-1 text-[11px] font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
              13 Months Ready
            </span>
          </div>

          {/* 5. Optional Password Protection */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Set Table Password / Security PIN
                </span>
              </div>
              <input
                type="checkbox"
                checked={enablePassword}
                onChange={(e) => setEnablePassword(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {enablePassword && (
              <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800 animate-in fade-in">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password or PIN"
                  className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={passwordHint}
                  onChange={(e) => setPasswordHint(e.target.value)}
                  placeholder="Password Hint (Optional)"
                  className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            onClick={closeCreateTableModal}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-create-table"
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Creating...' : 'Create Spreadsheet'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
