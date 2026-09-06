import React, { useState, useMemo } from 'react';
import { Folder, FolderPlus, X, Check, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SpreadsheetTable } from '../types';

interface MoveFolderModalProps {
  table: SpreadsheetTable;
  isOpen: boolean;
  onClose: () => void;
}

export const MoveFolderModal: React.FC<MoveFolderModalProps> = ({ table, isOpen, onClose }) => {
  const { tables, moveTableToFolder } = useApp();
  const [selectedFolder, setSelectedFolder] = useState<string>(table.folder_name || '');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    for (const t of tables) {
      if (t.folder_name && t.folder_name.trim()) {
        set.add(t.folder_name.trim());
      }
    }
    return Array.from(set).sort();
  }, [tables]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const targetFolder = isCreatingNew ? newFolderName.trim() : selectedFolder.trim();
      await moveTableToFolder(table.id, targetFolder || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-move-folder-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Move to Folder / Workplace
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Table: <span className="font-semibold text-slate-800 dark:text-slate-200">{table.name}</span>
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

        {/* Body */}
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Target Folder
            </label>
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              {isCreatingNew ? 'Choose Existing' : '+ Create New Folder'}
            </button>
          </div>

          {isCreatingNew ? (
            <div className="relative">
              <FolderPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter new folder name..."
                className="h-10 w-full rounded-xl border border-blue-300 bg-blue-50/50 pl-9 pr-3 text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-blue-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {/* Root / General option */}
              <button
                type="button"
                onClick={() => setSelectedFolder('')}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                  selectedFolder === ''
                    ? 'border-blue-600 bg-blue-50 font-bold text-blue-800 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>📂</span>
                  <span className="text-xs">Root / General (No Folder)</span>
                </div>
                {selectedFolder === '' && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              </button>

              {existingFolders.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFolder(f)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                    selectedFolder === f
                      ? 'border-blue-600 bg-blue-50 font-bold text-blue-800 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>📁</span>
                    <span className="text-xs">{f}</span>
                  </div>
                  {selectedFolder === f && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Moving...' : 'Move Table'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
