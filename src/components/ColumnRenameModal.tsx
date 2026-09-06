import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3 } from 'lucide-react';

interface ColumnRenameModalProps {
  currentName: string;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
}

export const ColumnRenameModal: React.FC<ColumnRenameModalProps> = ({
  currentName,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Column name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onSave(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to rename column');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="modal-column-rename"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl transition-all duration-200 dark:border dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="input-rename-column-name"
              className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-2"
            >
              Column Name
            </label>
            <input
              ref={inputRef}
              id="input-rename-column-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Column Name"
              className="h-12 w-full rounded-2xl border-2 border-blue-500 bg-white px-4 text-base font-semibold text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-3 focus:ring-blue-400/30 dark:border-blue-400 dark:bg-slate-950 dark:text-white"
            />
            {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
          </div>

          {/* Buttons: Cancel & Save (Matching Screenshot 2) */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-column-rename"
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              id="btn-save-column-rename"
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-blue-600 px-7 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
