import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Clock,
  Star,
  RotateCcw,
  Trash2,
  Archive,
  Plus,
  Upload,
  ArrowRight,
  MoreVertical,
  Edit2,
  Copy,
  Trash,
  RefreshCw,
  FolderOpen,
  Calendar,
  CheckCircle2,
  Database,
  Sparkles,
  Lock,
  FolderLock,
  Search,
  KeyRound,
  FolderInput,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MAD_PRODUCT_IMAGE } from '../assets/productImage';
import { ExcelImportModal } from './ExcelImportModal';
import { MoveFolderModal } from './MoveFolderModal';
import { SpreadsheetTable } from '../types';
import { formatLastOpenedTime, formatExactDateTime } from '../lib/dateUtils';

export const HomeDashboard: React.FC = () => {
  const {
    t,
    tables,
    openTable,
    openCreateTableModal,
    toggleFavorite,
    duplicateTable,
    deleteTable,
    renameTable,
    setCurrentTab,
    searchQuery,
    refreshAllData,
    isSyncing,
    lastSynced,
    syncMessage,
    openPasswordModal,
    setSelectedFolder,
  } = useApp();

  const { profile } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [movingTable, setMovingTable] = useState<SpreadsheetTable | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filter tables by search query with deduplication and sort by most recent modification/save
  const filteredTables = React.useMemo(() => {
    const map = new Map<string, SpreadsheetTable>();
    for (const tbl of tables) {
      if (tbl && tbl.id) {
        map.set(tbl.id, tbl);
      }
    }
    const list = Array.from(map.values()).filter((tbl) =>
      tbl.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return list.sort((a, b) => {
      const timeA = new Date(a.last_modified_date_time || a.last_opened_at || a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_modified_date_time || b.last_opened_at || b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [tables, searchQuery]);

  const favoriteTables = React.useMemo(() => filteredTables.filter((t) => t.favorite), [filteredTables]);
  const recentTables = React.useMemo(() => filteredTables.slice(0, 8), [filteredTables]);

  const handleStartRename = (tbl: SpreadsheetTable) => {
    setEditingTableId(tbl.id);
    setRenameValue(tbl.name);
    setActiveMenuId(null);
  };

  const handleSaveRename = (tblId: string) => {
    if (renameValue.trim()) {
      renameTable(tblId, renameValue.trim());
    }
    setEditingTableId(null);
  };

  const dashboardCards = [
    {
      id: 'card-all-tables',
      title: t.card_all_tables,
      desc: t.card_all_tables_desc,
      count: tables.length,
      icon: FileSpreadsheet,
      action: () => setCurrentTab('all_tables'),
      color: 'from-blue-600 to-blue-700',
    },
    {
      id: 'card-recent',
      title: t.card_recent_tables,
      desc: t.card_recent_tables_desc,
      count: recentTables.length,
      icon: Clock,
      action: () => setCurrentTab('recent'),
      color: 'from-indigo-600 to-indigo-700',
    },
    {
      id: 'card-favorites',
      title: t.card_favorites,
      desc: t.card_favorites_desc,
      count: favoriteTables.length,
      icon: Star,
      action: () => setCurrentTab('favorites'),
      color: 'from-amber-500 to-amber-600',
    },
    {
      id: 'card-recovery',
      title: t.card_recovery,
      desc: t.card_recovery_desc,
      icon: RotateCcw,
      action: () => setCurrentTab('recovery'),
      color: 'from-emerald-600 to-emerald-700',
    },
    {
      id: 'card-trash',
      title: t.card_trash,
      desc: t.card_trash_desc,
      icon: Trash2,
      action: () => setCurrentTab('trash'),
      color: 'from-rose-600 to-rose-700',
    },
    {
      id: 'card-backups',
      title: t.card_backups,
      desc: t.card_backups_desc,
      icon: Archive,
      action: () => setCurrentTab('backups'),
      color: 'from-purple-600 to-purple-700',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Hero Welcome Card with App Logo and Refresh Action */}
      <div
        id="hero-welcome-card"
        className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-7 md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative flex h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 shadow-md">
            <img
              src={MAD_PRODUCT_IMAGE}
              alt="MAD Ma'ed Table Salt Logo"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                መልካም ቀን
              </h1>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Manager: Abdii
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              እንኳን ወደ MAD በደህና መጡ • Miyawa 3A Business Spreadsheet System
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          {/* Refresh All Changes Data Button */}
          <button
            id="btn-hero-refresh-data"
            onClick={refreshAllData}
            title={`Last synced: ${lastSynced}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-100 active:scale-95 sm:flex-none dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
          >
            <RefreshCw
              className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 ${
                isSyncing ? 'animate-spin' : ''
              }`}
            />
            <span>{isSyncing ? 'Refreshing...' : 'Refresh All Data'}</span>
          </button>

          <button
            id="btn-hero-new-table"
            onClick={() => openCreateTableModal()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200/50 transition hover:bg-blue-700 active:scale-95 sm:flex-none dark:shadow-none"
          >
            <Plus className="h-4 w-4" />
            <span>+ Create New Table</span>
          </button>

          <button
            id="btn-hero-import-excel"
            onClick={() => setShowImportModal(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 sm:flex-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>Import Excel</span>
          </button>
        </div>
      </div>

      {/* Dashboard Section Cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Navigation & Workspaces
          </h2>
          <button
            onClick={refreshAllData}
            title="Refresh workspaces and counts"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {dashboardCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                id={card.id}
                onClick={card.action}
                className="group flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-white shadow-xs`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {card.count !== undefined && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {card.count}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {card.title}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {card.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Spreadsheets Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t.card_recent_tables}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage, calculate formulas, and synchronize your spreadsheets
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh Icon Button for Recent Tables */}
            <button
              id="btn-refresh-recent-tables"
              onClick={refreshAllData}
              title={`Refresh all changes (Last synced: ${lastSynced})`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition active:scale-95"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setCurrentTab('all_tables')}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>{t.nav_all_tables}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {recentTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-800">
            <FileSpreadsheet className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              No spreadsheets created yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Click below to create your first business spreadsheet.
            </p>
            <button
              onClick={() => openCreateTableModal()}
              className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>{t.create_table}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentTables.map((tbl, idx) => (
              <div
                key={tbl.id ? `recent-${tbl.id}` : `recent-tbl-${idx}`}
                id={`recent-table-${tbl.id}`}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-blue-400 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-blue-500 dark:hover:bg-slate-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>

                      {editingTableId === tbl.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(tbl.id)}
                            autoFocus
                            className="h-7 w-36 rounded border border-blue-500 bg-white px-1.5 text-xs font-bold dark:bg-slate-900"
                          />
                          <button
                            onClick={() => handleSaveRename(tbl.id)}
                            className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3
                              onClick={() => openTable(tbl.id)}
                              className="cursor-pointer truncate text-sm font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                            >
                              {tbl.name}
                            </h3>
                            {tbl.is_password_protected && (
                              <span
                                title="Password Protected Folder"
                                className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              >
                                <Lock className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Updated: {new Date(tbl.updated_at).toLocaleDateString()}
                            </span>
                            {tbl.folder_name && (
                              <span
                                onClick={() => {
                                  setSelectedFolder(tbl.folder_name || null);
                                  setCurrentTab('all_tables');
                                }}
                                className="cursor-pointer rounded bg-slate-200/60 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                              >
                                📁 {tbl.folder_name}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(tbl.id)}
                        className={`rounded-md p-1.5 transition ${
                          tbl.favorite
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                        title={tbl.favorite ? t.unfavorite_table : t.favorite_table}
                      >
                        <Star className={`h-4 w-4 ${tbl.favorite ? 'fill-amber-400' : ''}`} />
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === tbl.id ? null : tbl.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {activeMenuId === tbl.id && (
                          <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                            <button
                              onClick={() => handleStartRename(tbl)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                              {t.rename_table}
                            </button>

                            <button
                              onClick={() => {
                                setMovingTable(tbl);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <FolderInput className="h-3.5 w-3.5 text-amber-500" />
                              Move to Folder...
                            </button>

                            <button
                              onClick={() => {
                                openPasswordModal(tbl, 'SET');
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <FolderLock className="h-3.5 w-3.5 text-blue-500" />
                              {tbl.is_password_protected ? 'Change Password' : 'Set Password'}
                            </button>

                            {tbl.is_password_protected && (
                              <button
                                onClick={() => {
                                  openPasswordModal(tbl, 'LOOKUP');
                                  setActiveMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Search className="h-3.5 w-3.5 text-indigo-500" />
                                Password Lookup
                              </button>
                            )}

                            <button
                              onClick={() => {
                                duplicateTable(tbl.id);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <Copy className="h-3.5 w-3.5 text-slate-400" />
                              {t.duplicate_table}
                            </button>
                            <button
                              onClick={() => {
                                deleteTable(tbl.id);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash className="h-3.5 w-3.5" />
                              {t.delete_table}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Folder Open & Device / Browser Change Metadata */}
                  <div className="mt-3 space-y-1.5">
                    {/* Folder Open & Last Opened Time Badge */}
                    <div
                      className="flex items-center gap-1.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 px-2.5 py-1.5 text-[11px] font-medium text-blue-800 dark:text-blue-200"
                      title={`Exact last opened: ${formatExactDateTime(tbl.last_opened_at || tbl.updated_at)}`}
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold">Last open:</span>
                      <span className="truncate">
                        {formatLastOpenedTime(tbl.last_opened_at || tbl.updated_at)}
                      </span>
                    </div>

                    {/* Device & Browser Change Method Badge */}
                    <div
                      className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300"
                      title={`Last modified by ${tbl.last_modified_by_device || 'Device'} using ${tbl.last_modified_by_browser || 'Browser'} at ${formatExactDateTime(tbl.last_modified_date_time || tbl.updated_at)}`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span>{tbl.last_modified_by_device_type === 'phone' ? '📱' : '💻'} {tbl.last_modified_by_device || 'Current Device'}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">{tbl.last_modified_by_browser || 'Browser'}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {tbl.last_change_method && (
                          <span className="rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 font-bold text-[9px]">
                            {tbl.last_change_method}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      MAD Miyawa 3A
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      {formatExactDateTime(tbl.last_modified_date_time || tbl.updated_at)}
                    </span>
                  </div>
                  <button
                    onClick={() => openTable(tbl.id)}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 transition active:scale-95"
                  >
                    <FolderOpen className="h-3 w-3" />
                    <span>{t.open_table}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Excel Import Modal */}
      {showImportModal && <ExcelImportModal onClose={() => setShowImportModal(false)} />}
      {movingTable && (
        <MoveFolderModal
          isOpen={Boolean(movingTable)}
          table={movingTable}
          onClose={() => setMovingTable(null)}
        />
      )}
    </div>
  );
};

