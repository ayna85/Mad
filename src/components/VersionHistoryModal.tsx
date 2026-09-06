import React, { useEffect, useState } from 'react';
import { X, History, RotateCcw, Eye, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';
import { TableVersion } from '../types';

interface VersionHistoryModalProps {
  tableId: string;
  tableName: string;
  onClose: () => void;
  onRestore: () => Promise<void>;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  tableId,
  tableName,
  onClose,
  onRestore,
}) => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<TableVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<TableVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (user) {
      loadVersions();
    }
  }, [tableId, user]);

  const loadVersions = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await dbService.getVersions(tableId, user.id);
      setVersions(data);
      if (data.length > 0) setSelectedVersion(data[0]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (version: TableVersion) => {
    if (!user) return;
    setIsRestoring(true);
    try {
      await dbService.restoreVersion(tableId, version.id, user.id);
      await onRestore();
      onClose();
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      id="modal-version-history"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Version History
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

        {/* Content split pane */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left list of versions */}
          <div className="w-1/3 border-r border-slate-200 overflow-y-auto p-3 dark:border-slate-800">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading versions...</div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No versions recorded yet. Versions are created automatically when significant changes are made.
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map((ver, idx) => (
                  <div
                    key={ver.id ? `ver-hist-${ver.id}` : `ver-hist-${idx}`}
                    onClick={() => setSelectedVersion(ver)}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      selectedVersion?.id === ver.id
                        ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Version {ver.version_number}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ver.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">
                      {ver.change_description || 'Snapshot'}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(ver.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right preview of selected version */}
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            {selectedVersion ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Version #{selectedVersion.version_number} Snapshot
                    </h3>
                    <p className="text-xs text-slate-500">
                      {new Date(selectedVersion.created_at).toLocaleString()} • {selectedVersion.change_description}
                    </p>
                  </div>

                  <button
                    disabled={isRestoring}
                    onClick={() => handleRestore(selectedVersion)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{isRestoring ? 'Restoring...' : 'Restore Version'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-auto py-3">
                  <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Columns ({selectedVersion.snapshot.columns?.length || 0}) • Rows ({selectedVersion.snapshot.rows?.length || 0})
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="p-2 border-b">#</th>
                          {(selectedVersion.snapshot.columns || []).map((col, cIdx) => (
                            <th key={col.id ? `vh-col-${col.id}` : `vh-col-${cIdx}`} className="p-2 border-b">
                              {col.name} ({col.type})
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedVersion.snapshot.rows || []).slice(0, 8).map((row, rIdx) => (
                          <tr key={row.id ? `vh-row-${row.id}` : `vh-row-${rIdx}`} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="p-2 font-mono text-slate-400">{rIdx + 1}</td>
                            {(selectedVersion.snapshot.columns || []).map((col, cIdx) => {
                              const val = selectedVersion.snapshot.cells?.[`${row.id}_${col.id}`];
                              return (
                                <td key={`vh-cell-${row.id || rIdx}-${col.id || cIdx}`} className="p-2">
                                  {val !== undefined ? String(val) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-auto rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="h-4 w-4" />
                    Safe Version Restore
                  </div>
                  <p className="mt-0.5 text-[11px]">
                    Restoring this version will create a backup snapshot of your current spreadsheet first so no work is lost.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Select a version from the left to view details and restore.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
