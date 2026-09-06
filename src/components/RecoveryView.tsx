import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  Clock,
  Archive,
  ArrowRight,
  Check,
  AlertTriangle,
  History,
  Lock,
  Unlock,
  KeyRound,
  Download,
  Plus,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';
import { BackupRecord, TableVersion, DeletedItem, SpreadsheetTable } from '../types';

export const RecoveryView: React.FC = () => {
  const { t, refreshTables, openTable, setCurrentTab } = useApp();
  const { user, verifyRecoveryPassword } = useAuth();

  // Recovery Password & Lock State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tabs: Backups, Trash, Table History
  const [activeSubTab, setActiveSubTab] = useState<'backups' | 'trash' | 'table_history'>('backups');

  // Data states
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [versions, setVersions] = useState<TableVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Restore Confirmation Modal State
  const [restoreModalConfig, setRestoreModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    itemName: string;
    itemType: 'backup' | 'trash' | 'version';
    id: string;
    snapshot?: any;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Delete Permanently Modal State
  const [permDeleteModalConfig, setPermDeleteModalConfig] = useState<{
    isOpen: boolean;
    itemName: string;
    id: string;
  } | null>(null);

  // Search filter inside recovery
  const [searchQuery, setSearchQuery] = useState('');

  // Unlocked recovery filtered data (Hooks must be called unconditionally at top level)
  const filteredBackups = useMemo(() => {
    const map = new Map<string, BackupRecord>();
    for (const b of backups) {
      if (b && b.id && !map.has(b.id)) map.set(b.id, b);
    }
    return Array.from(map.values()).filter((b) =>
      (b.table_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [backups, searchQuery]);

  const filteredTrash = useMemo(() => {
    const map = new Map<string, DeletedItem>();
    for (const i of deletedItems) {
      if (i && i.id && !map.has(i.id)) map.set(i.id, i);
    }
    return Array.from(map.values()).filter((i) =>
      (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.original_location || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [deletedItems, searchQuery]);

  const filteredVersions = useMemo(() => {
    const map = new Map<string, TableVersion>();
    for (const v of versions) {
      if (v && v.id && !map.has(v.id)) map.set(v.id, v);
    }
    return Array.from(map.values()).filter((v) =>
      (v.change_description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [versions, searchQuery]);

  // 15-Minute Session Activity Tracker
  const resetLockTimer = () => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    // 15 minutes = 15 * 60 * 1000 ms
    lockTimerRef.current = setTimeout(() => {
      setIsUnlocked(false);
      setPasswordInput('');
      setPasswordError('Recovery session timed out. Please enter your password to unlock.');
    }, 15 * 60 * 1000);
  };

  useEffect(() => {
    if (isUnlocked) {
      resetLockTimer();
      const onUserActivity = () => resetLockTimer();
      window.addEventListener('mousemove', onUserActivity);
      window.addEventListener('keydown', onUserActivity);
      return () => {
        window.removeEventListener('mousemove', onUserActivity);
        window.removeEventListener('keydown', onUserActivity);
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      };
    }
  }, [isUnlocked]);

  // Clean up lock state when unmounting
  useEffect(() => {
    return () => {
      setIsUnlocked(false);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!passwordInput) {
      setPasswordError('Please enter your account password.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyRecoveryPassword(passwordInput);
      if (res.success) {
        setIsUnlocked(true);
        setPasswordInput('');
        setPasswordError('');
        loadRecoveryData();
      } else {
        setPasswordError('Incorrect password.');
      }
    } catch (err: any) {
      setPasswordError('Incorrect password.');
    } finally {
      setIsVerifying(false);
    }
  };

  const loadRecoveryData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [bks, trash, vers] = await Promise.all([
        dbService.getBackups(user.id),
        dbService.getDeletedItems(user.id),
        dbService.getAllVersions(user.id),
      ]);
      setBackups(bks);
      setDeletedItems(trash);
      setVersions(vers);
    } finally {
      setIsLoading(false);
    }
  };

  // Create Manual System Backup
  const handleCreateManualBackup = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await dbService.createFullSystemBackup(user.id, `Manual full backup by user on ${new Date().toLocaleString()}`);
      setStatusMsg('System backup created successfully!');
      setTimeout(() => setStatusMsg(''), 3500);
      await loadRecoveryData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create backup.');
      setTimeout(() => setErrorMsg(''), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  // Download Backup JSON
  const handleDownloadBackup = (backup: BackupRecord) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `MAD_Backup_${backup.table_name.replace(/\s+/g, '_')}_${new Date(backup.created_at).toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Execute Restore Action with Security & Pre-Backup
  const handleExecuteRestore = async () => {
    if (!restoreModalConfig || !user) return;
    setIsRestoring(true);
    setErrorMsg('');
    try {
      const { itemType, id } = restoreModalConfig;

      if (itemType === 'trash') {
        await dbService.restoreTrashItem(id, user.id);
        setStatusMsg(`Item restored to database successfully.`);
      } else if (itemType === 'version') {
        const ver = versions.find((v) => v.id === id);
        if (ver) {
          await dbService.restoreVersion(ver.table_id, ver.id, user.id);
          setStatusMsg(`Version #${ver.version_number} restored safely.`);
        }
      } else if (itemType === 'backup') {
        const bk = backups.find((b) => b.id === id);
        if (bk && bk.table_id) {
          // If table backup, restore table snapshot
          if (bk.snapshot) {
            await dbService.createBackup(bk.table_id, user.id, 'auto', `Auto backup before restoring ${bk.table_name}`);
            const snap = bk.snapshot;
            if (snap.id) {
              await dbService.saveTableMetadata(snap.id, user.id, { name: snap.name, favorite: snap.favorite });
              if (snap.columns?.length) {
                for (const col of snap.columns) {
                  await dbService.updateColumn(col.id, user.id, col);
                }
              }
            }
          }
          setStatusMsg(`Backup '${bk.table_name}' restored successfully.`);
        } else if (bk && bk.snapshot?.tables) {
          // Full multi-table backup restore
          for (const tbl of bk.snapshot.tables) {
            await dbService.saveTableMetadata(tbl.id, user.id, { name: tbl.name, favorite: tbl.favorite });
          }
          setStatusMsg(`Full system backup restored successfully.`);
        }
      }

      setRestoreModalConfig(null);
      await loadRecoveryData();
      await refreshTables();
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Restore failed.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Permanent Delete
  const handleExecutePermanentDelete = async () => {
    if (!permDeleteModalConfig || !user) return;
    try {
      await dbService.permanentlyDeleteTrashItem(permDeleteModalConfig.id, user.id);
      setStatusMsg(`Item permanently deleted.`);
      setPermDeleteModalConfig(null);
      await loadRecoveryData();
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete permanently.');
    }
  };

  // If locked, render Password Prompt
  if (!isUnlocked) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center p-4">
        <div
          id="recovery-password-lock-card"
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"
        >
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <KeyRound className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
              Enter Password to Access Recovery
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Recovery contains sensitive database backups, version histories, and deleted business spreadsheets. Confirm your Supabase account password to unlock.
            </p>
          </div>

          {passwordError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="input-recovery-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your account password"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-10 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCurrentTab('home')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                id="btn-unlock-recovery"
                type="submit"
                disabled={isVerifying}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Unlock Recovery</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
              Recovery Center
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              <Unlock className="h-3 w-3" /> Unlocked
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Disaster recovery, automated pre-destructive backups, version rollbacks, and trash manager
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-create-full-backup"
            onClick={handleCreateManualBackup}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Full Backup</span>
          </button>

          <button
            onClick={() => setIsUnlocked(false)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            title="Lock Recovery immediately"
          >
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-xs font-bold text-red-800 dark:bg-red-950/60 dark:text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex space-x-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
          <button
            id="tab-recovery-backups"
            onClick={() => setActiveSubTab('backups')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeSubTab === 'backups'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Backups ({backups.length})</span>
          </button>

          <button
            id="tab-recovery-trash"
            onClick={() => setActiveSubTab('trash')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeSubTab === 'trash'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Trash ({deletedItems.length})</span>
          </button>

          <button
            id="tab-recovery-history"
            onClick={() => setActiveSubTab('table_history')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeSubTab === 'table_history'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Table History ({versions.length})</span>
          </button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* SUB TAB 1: BACKUPS */}
      {activeSubTab === 'backups' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Database & Spreadsheet Backups ({filteredBackups.length})
            </h2>
          </div>

          {filteredBackups.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No backups found. Click "Create Full Backup" to generate a disaster recovery snapshot.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBackups.map((bk, idx) => (
                <div
                  key={`rec-bk-${bk.id || idx}-${idx}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      <Archive className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          {bk.table_name}
                        </h3>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            bk.backup_type === 'pre_destructive'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : bk.backup_type === 'manual'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {bk.backup_type}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {bk.description}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(bk.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadBackup(bk)}
                      className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      title="Download JSON"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>

                    <button
                      id={`btn-restore-backup-${bk.id}`}
                      onClick={() =>
                        setRestoreModalConfig({
                          isOpen: true,
                          title: 'Restore Backup',
                          itemName: bk.table_name,
                          itemType: 'backup',
                          id: bk.id,
                        })
                      }
                      className="flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB TAB 2: TRASH (Tables, Columns, Rows, Files) */}
      {activeSubTab === 'trash' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Trash & Recently Deleted Items ({filteredTrash.length})
            </h2>
          </div>

          {filteredTrash.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Trash is empty. No deleted tables, columns, or rows found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTrash.map((item, idx) => (
                <div
                  key={`rec-trash-${item.id || idx}-${idx}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </h3>
                        <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase dark:bg-slate-800 dark:text-slate-300">
                          {item.item_type}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        From: {item.original_location}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Deleted: {new Date(item.deleted_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setPermDeleteModalConfig({
                          isOpen: true,
                          itemName: item.name,
                          id: item.id,
                        })
                      }
                      className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-400"
                    >
                      Delete Permanently
                    </button>

                    <button
                      id={`btn-restore-trash-${item.id}`}
                      onClick={() =>
                        setRestoreModalConfig({
                          isOpen: true,
                          title: 'Restore Deleted Item',
                          itemName: item.name,
                          itemType: 'trash',
                          id: item.id,
                        })
                      }
                      className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB TAB 3: TABLE HISTORY */}
      {activeSubTab === 'table_history' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Table Versions & Change History ({filteredVersions.length})
            </h2>
          </div>

          {filteredVersions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No version history records found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVersions.map((v, idx) => (
                <div
                  key={`rec-ver-${v.id || idx}-${idx}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                      <History className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-extrabold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          v{v.version_number}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          {v.change_description}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {v.snapshot?.columns?.length || 0} columns • {v.snapshot?.rows?.length || 0} rows
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    id={`btn-restore-version-${v.id}`}
                    onClick={() =>
                      setRestoreModalConfig({
                        isOpen: true,
                        title: `Restore Version #${v.version_number}`,
                        itemName: `Version #${v.version_number} (${v.change_description})`,
                        itemType: 'version',
                        id: v.id,
                      })
                    }
                    className="flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore Version</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RESTORE CONFIRMATION SECURITY MODAL */}
      {restoreModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {restoreModalConfig.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Restore <strong className="text-slate-900 dark:text-white">"{restoreModalConfig.itemName}"</strong>? This will overwrite or restore data to the active database. An automatic backup will be created before restoring.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestoreModalConfig(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-restore"
                type="button"
                disabled={isRestoring}
                onClick={handleExecuteRestore}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Restoring to Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirm Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {permDeleteModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-900/50 dark:bg-slate-900">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Permanently Delete Item
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">"{permDeleteModalConfig.itemName}"</strong>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPermDeleteModalConfig(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-perm-delete"
                type="button"
                onClick={handleExecutePermanentDelete}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
