import React, { useState } from 'react';
import { Trash2, FolderX, Folder, AlertTriangle, X, Check, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface DeleteFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  tableCount: number;
}

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  isOpen,
  onClose,
  folderName,
  tableCount,
}) => {
  const { deleteFolder } = useApp();
  const [deleteMode, setDeleteMode] = useState<'trash_tables' | 'ungroup_tables'>('trash_tables');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !folderName) return null;

  const handleDelete = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await deleteFolder(folderName, deleteMode);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete folder');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="delete-folder-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="delete-folder-modal-card"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Folder
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Workplace Folder: <span className="font-bold text-slate-800 dark:text-slate-200">"{folderName}"</span>
              </p>
            </div>
          </div>
          <button
            id="btn-close-delete-folder"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Folder contains {tableCount} spreadsheet{tableCount === 1 ? '' : 's'}</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-400/90">
            Choose what you want to do with the spreadsheets currently stored in this folder:
          </p>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Options Selection */}
        <div className="mt-4 space-y-3">
          <label
            onClick={() => setDeleteMode('trash_tables')}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              deleteMode === 'trash_tables'
                ? 'border-rose-300 bg-rose-50/40 dark:border-rose-800 dark:bg-rose-950/20 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/40'
            }`}
          >
            <input
              type="radio"
              name="deleteMode"
              checked={deleteMode === 'trash_tables'}
              onChange={() => setDeleteMode('trash_tables')}
              className="mt-1 h-4 w-4 text-rose-600 focus:ring-rose-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Delete Folder & Move Sheets to Trash
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Removes the folder from Workplace and sends all {tableCount} spreadsheet{tableCount === 1 ? '' : 's'} to Trash with automated backup recovery snapshots.
              </p>
            </div>
          </label>

          <label
            onClick={() => setDeleteMode('ungroup_tables')}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              deleteMode === 'ungroup_tables'
                ? 'border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/40'
            }`}
          >
            <input
              type="radio"
              name="deleteMode"
              checked={deleteMode === 'ungroup_tables'}
              onChange={() => setDeleteMode('ungroup_tables')}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FolderX className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Keep Spreadsheets (Ungroup from Folder)
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Deletes the folder label only. Spreadsheets remain intact and accessible in your main Workplace spreadsheet list.
              </p>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            id="btn-cancel-delete-folder"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-confirm-delete-folder"
            onClick={handleDelete}
            disabled={isProcessing}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95 ${
              deleteMode === 'trash_tables'
                ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            {isProcessing ? (
              <span>Processing...</span>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {deleteMode === 'trash_tables' ? 'Delete Folder & Sheets' : 'Ungroup & Remove Folder'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
