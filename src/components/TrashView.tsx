import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Check, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';
import { SpreadsheetTable } from '../types';

export const TrashView: React.FC = () => {
  const { t, refreshTables } = useApp();
  const { user } = useAuth();

  const [trashList, setTrashList] = useState<SpreadsheetTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const uniqueTrashList = React.useMemo(() => {
    const map = new Map<string, SpreadsheetTable>();
    for (const tbl of trashList) {
      if (tbl && tbl.id && !map.has(tbl.id)) {
        map.set(tbl.id, tbl);
      }
    }
    return Array.from(map.values());
  }, [trashList]);

  const loadTrash = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await dbService.getTrashTables(user.id);
      setTrashList(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, [user]);

  const handleRestore = async (tblId: string) => {
    if (!user) return;
    await dbService.restoreTable(tblId, user.id);
    setStatusMsg('Table restored to active workspace.');
    setTimeout(() => setStatusMsg(''), 3000);
    await loadTrash();
    await refreshTables();
  };

  const handlePermanentDelete = async (tblId: string) => {
    if (!user) return;
    await dbService.permanentlyDeleteTable(tblId, user.id);
    setConfirmDeleteId(null);
    setStatusMsg('Table permanently destroyed.');
    setTimeout(() => setStatusMsg(''), 3000);
    await loadTrash();
  };

  const handleEmptyAllTrash = async () => {
    if (!user) return;
    for (const item of trashList) {
      await dbService.permanentlyDeleteTable(item.id, user.id);
    }
    setConfirmEmptyTrash(false);
    setStatusMsg('Trash emptied completely.');
    setTimeout(() => setStatusMsg(''), 3000);
    await loadTrash();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
            {t.trash_title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.trash_desc}</p>
        </div>

        {trashList.length > 0 && (
          <button
            onClick={() => setConfirmEmptyTrash(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            <span>{t.empty_trash}</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <Check className="h-4 w-4" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Trash List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading trash...</div>
        ) : uniqueTrashList.length === 0 ? (
          <div className="py-16 text-center">
            <Trash2 className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
              Trash is empty
            </h3>
            <p className="mt-1 text-xs text-slate-400">Deleted spreadsheets will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uniqueTrashList.map((tbl, idx) => (
              <div
                key={`trash-item-${tbl.id || idx}-${idx}`}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">{tbl.name}</h3>
                    <p className="text-[10px] text-slate-400">
                      Deleted: {new Date(tbl.deleted_at || tbl.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(tbl.id)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{t.restore_table}</span>
                  </button>

                  <button
                    onClick={() => setConfirmDeleteId(tbl.id)}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t.delete_forever}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Single Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Permanent Deletion
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to permanently delete this spreadsheet? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePermanentDelete(confirmDeleteId)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Empty Trash Modal */}
      {confirmEmptyTrash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Empty Trash</h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to permanently delete all {trashList.length} spreadsheets in trash?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmEmptyTrash(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyAllTrash}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700"
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
