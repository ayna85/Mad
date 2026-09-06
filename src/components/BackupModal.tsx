import React, { useState } from 'react';
import { X, Archive, Plus, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';
import { BackupRecord } from '../types';

interface BackupModalProps {
  tableId: string;
  tableName: string;
  onClose: () => void;
  onRestore: () => Promise<void>;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  tableId,
  tableName,
  onClose,
  onRestore,
}) => {
  const { user } = useAuth();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
    if (user) {
      loadBackups();
    }
  }, [tableId, user]);

  const loadBackups = async () => {
    if (!user) return;
    const all = await dbService.getBackups(user.id);
    setBackups(all.filter((b) => b.table_id === tableId));
  };

  const handleCreate = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      await dbService.createBackup(
        tableId,
        user.id,
        'manual',
        description.trim() || `Manual backup of '${tableName}'`
      );
      setDescription('');
      setSuccessMsg('Backup snapshot created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadBackups();
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (backup: BackupRecord) => {
    if (!user) return;
    setIsRestoringId(backup.id);
    try {
      const snap = backup.snapshot;
      if (snap) {
        // Save to current table
        if (snap.columns) {
          for (const col of snap.columns) await dbService.updateColumn(col.id, user.id, col);
        }
        await onRestore();
        setSuccessMsg(`Restored backup from ${new Date(backup.created_at).toLocaleString()}`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } finally {
      setIsRestoringId(null);
    }
  };

  return (
    <div
      id="modal-backups"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <Archive className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Spreadsheet Backups & Snapshots
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{tableName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Create Backup Input */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Create New Backup
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional backup note (e.g. Before monthly audit reconciliation)..."
                className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                disabled={isCreating}
                onClick={handleCreate}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-purple-700 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>{isCreating ? 'Creating...' : 'Save Backup'}</span>
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              <Check className="h-4 w-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Backup List */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Saved Snapshots ({backups.length})
            </h3>

            {backups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
                No backup records for this table yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {backups.map((b, idx) => (
                  <div
                    key={b.id ? `backup-modal-${b.id}` : `backup-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            b.backup_type === 'pre_destructive'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          }`}
                        >
                          {b.backup_type === 'pre_destructive' ? 'Pre-action Auto' : 'Manual'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {b.description}
                        </h4>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(b.created_at).toLocaleString()}
                      </p>
                    </div>

                    <button
                      disabled={isRestoringId === b.id}
                      onClick={() => handleRestore(b)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                      <span>{isRestoringId === b.id ? 'Restoring...' : 'Restore'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-6 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
