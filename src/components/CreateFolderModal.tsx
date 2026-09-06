import React, { useState } from 'react';
import { FolderPlus, Folder, Lock, FileSpreadsheet, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ isOpen, onClose }) => {
  const { createNewTable, setTablePassword } = useApp();
  const [folderName, setFolderName] = useState('');
  const [spreadsheetName, setSpreadsheetName] = useState('');
  const [enablePassword, setEnablePassword] = useState(false);
  const [folderPassword, setFolderPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanFolder = folderName.trim();
    if (!cleanFolder) {
      setError('Please enter a folder name');
      return;
    }

    setIsSubmitting(true);
    try {
      const initialSheetName = spreadsheetName.trim() || `${cleanFolder} - Overview`;
      const newTable = await createNewTable(initialSheetName, undefined, cleanFolder);
      
      // If password requested
      if (enablePassword && folderPassword) {
        await setTablePassword(newTable.id, folderPassword, passwordHint, cleanFolder);
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="create-folder-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="create-folder-modal-card"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Create Workspace Folder
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organize your spreadsheets into protected or shared folders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Folder Name *
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="input-new-folder-name"
                type="text"
                value={folderName}
                autoFocus
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Finance & Invoices, Q3 Inventory"
                className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Initial Spreadsheet Name (Optional)
            </label>
            <div className="relative">
              <FileSpreadsheet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={spreadsheetName}
                onChange={(e) => setSpreadsheetName(e.target.value)}
                placeholder="Leave blank for auto-naming"
                className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* Folder Password Protection Toggle */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Protect Folder with Password / PIN
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
              <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in">
                <input
                  type="password"
                  value={folderPassword}
                  onChange={(e) => setFolderPassword(e.target.value)}
                  placeholder="Enter Folder Password or PIN"
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

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              id="btn-create-folder-submit"
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Folder...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
