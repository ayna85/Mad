import React, { useState, useEffect } from 'react';
import {
  FolderEdit,
  FolderOpen,
  FileSpreadsheet,
  X,
  Check,
  Tag,
  Sparkles,
  AlertCircle,
  Save,
} from 'lucide-react';
import { SpreadsheetTable } from '../types';
import { useApp } from '../context/AppContext';

interface FolderRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: SpreadsheetTable;
  onSuccess?: (newName: string, newFolderName?: string) => void;
}

const COMMON_FOLDERS = ['Finance', 'Sales', 'Inventory', 'Operations', 'Reports', 'Miyawa 3A'];

export const FolderRenameModal: React.FC<FolderRenameModalProps> = ({
  isOpen,
  onClose,
  table,
  onSuccess,
}) => {
  const { renameTable, moveTableToFolder } = useApp();

  const [tableName, setTableName] = useState(table.name || '');
  const [folderName, setFolderName] = useState(table.folder_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTableName(table.name || '');
      setFolderName(table.folder_name || '');
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, table]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = tableName.trim();
    if (!cleanName) {
      setErrorMessage('Spreadsheet name cannot be empty.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const cleanFolder = folderName.trim() || undefined;
      await renameTable(table.id, cleanName);
      await moveTableToFolder(table.id, cleanFolder);
      setSuccessMessage('Folder and spreadsheet renamed successfully!');

      if (onSuccess) {
        onSuccess(cleanName, cleanFolder);
      }

      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="modal-folder-rename-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="modal-folder-rename-dialog"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              <FolderEdit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Rename Spreadsheet & Folder
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Update the display title and folder category
              </p>
            </div>
          </div>
          <button
            id="btn-close-folder-rename"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Feedback messages */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Table / File Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="input-rename-table-name"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Spreadsheet Name *</span>
            </label>
            <input
              id="input-rename-table-name"
              type="text"
              required
              autoFocus
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. Sales Ledger 2026"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* Folder Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="input-rename-folder-name"
              className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              <div className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                <span>Folder / Workspace (Optional)</span>
              </div>
              {folderName && (
                <button
                  type="button"
                  onClick={() => setFolderName('')}
                  className="text-[10px] text-slate-400 hover:text-red-500"
                >
                  Clear folder
                </button>
              )}
            </label>
            <input
              id="input-rename-folder-name"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Finance, Inventory, Reports"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />

            {/* Quick folder chips */}
            <div className="pt-1">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Quick Categories:
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {COMMON_FOLDERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFolderName(f)}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition ${
                      folderName.toLowerCase() === f.toLowerCase()
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              id="btn-cancel-rename"
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              id="btn-save-folder-rename"
              type="submit"
              disabled={isSaving || !tableName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Rename'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
