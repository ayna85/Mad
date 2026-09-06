import React, { useState, useEffect } from 'react';
import { FolderEdit, Folder, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface RenameFolderModalGlobalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFolderName: string;
}

export const RenameFolderModalGlobal: React.FC<RenameFolderModalGlobalProps> = ({
  isOpen,
  onClose,
  initialFolderName,
}) => {
  const { renameFolder } = useApp();
  const [folderName, setFolderName] = useState(initialFolderName || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName(initialFolderName || '');
      setError(null);
    }
  }, [isOpen, initialFolderName]);

  if (!isOpen || !initialFolderName) return null;

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = folderName.trim();
    if (!cleanNew) {
      setError('Please enter a valid folder name');
      return;
    }
    if (cleanNew.toLowerCase() === initialFolderName.toLowerCase()) {
      onClose();
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await renameFolder(initialFolderName, cleanNew);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to rename folder');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="rename-folder-global-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="rename-folder-global-card"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <FolderEdit className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Rename Folder
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Current: <span className="font-bold text-slate-800 dark:text-slate-200">"{initialFolderName}"</span>
              </p>
            </div>
          </div>
          <button
            id="btn-close-rename-folder-global"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleRename} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              New Folder Name
            </label>
            <div className="relative mt-1.5">
              <Folder className="absolute top-3 left-3 h-4 w-4 text-amber-500" />
              <input
                type="text"
                id="input-rename-folder-new-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Financial Reports 2026"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-xs font-medium text-slate-900 shadow-2xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              id="btn-cancel-rename-folder-global"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-rename-folder-global"
              disabled={isProcessing || !folderName.trim()}
              className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Renaming...</span>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Update Folder</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
