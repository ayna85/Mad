import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Star,
  MoreVertical,
  Plus,
  Upload,
  Clock,
  ArrowRight,
  Edit2,
  Copy,
  Trash,
  Search,
  RefreshCw,
  FolderOpen,
  Lock,
  FolderLock,
  KeyRound,
  Folder,
  FolderInput,
  FolderEdit,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ExcelImportModal } from './ExcelImportModal';
import { MoveFolderModal } from './MoveFolderModal';
import { DeleteFolderModal } from './DeleteFolderModal';
import { RenameFolderModalGlobal } from './RenameFolderModalGlobal';
import { SpreadsheetTable } from '../types';
import { formatLastOpenedTime, formatExactDateTime } from '../lib/dateUtils';

interface TableViewListProps {
  mode: 'all' | 'recent' | 'favorites';
}

export const TableViewList: React.FC<TableViewListProps> = ({ mode }) => {
  const {
    t,
    tables,
    openTable,
    openCreateTableModal,
    toggleFavorite,
    duplicateTable,
    deleteTable,
    renameTable,
    searchQuery,
    refreshAllData,
    isSyncing,
    lastSynced,
    openPasswordModal,
    selectedFolder,
    setSelectedFolder,
  } = useApp();

  const [showImportModal, setShowImportModal] = useState(false);
  const [movingTable, setMovingTable] = useState<SpreadsheetTable | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isDeleteFolderOpen, setIsDeleteFolderOpen] = useState(false);
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false);

  const query = (searchQuery || localSearch).toLowerCase().trim();

  const filtered = React.useMemo(() => {
    const map = new Map<string, SpreadsheetTable>();
    for (const tbl of tables) {
      if (tbl && tbl.id) {
        map.set(tbl.id, tbl);
      }
    }
    let list = Array.from(map.values()).filter((tbl) => tbl.name.toLowerCase().includes(query));

    if (mode === 'favorites') {
      list = list.filter((tbl) => tbl.favorite);
    } else if (mode === 'recent') {
      // Recent tables sorted by last_modified_date_time, last_opened_at, or updated_at
      list = [...list].sort((a, b) => {
        const timeA = new Date(a.last_modified_date_time || a.last_opened_at || a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_modified_date_time || b.last_opened_at || b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });
    } else if (mode === 'all') {
      list = [...list].sort((a, b) => {
        const timeA = new Date(a.last_modified_date_time || a.last_opened_at || a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_modified_date_time || b.last_opened_at || b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });
      if (selectedFolder) {
        list = list.filter((tbl) => (tbl.folder_name || '').toLowerCase() === selectedFolder.toLowerCase());
      }
    }

    return list;
  }, [tables, query, mode, selectedFolder]);

  const title =
    mode === 'favorites'
      ? t.card_favorites
      : mode === 'recent'
      ? t.card_recent_tables
      : selectedFolder
      ? `Folder: ${selectedFolder}`
      : t.card_all_tables;

  const desc =
    mode === 'favorites'
      ? t.card_favorites_desc
      : mode === 'recent'
      ? t.card_recent_tables_desc
      : selectedFolder
      ? `Spreadsheets organized inside ${selectedFolder} workspace`
      : t.card_all_tables_desc;

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
              {title} ({filtered.length})
            </h1>
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(null)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                title="Clear folder filter"
              >
                <span>Clear</span>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh all changes button */}
          <button
            onClick={refreshAllData}
            title={`Refresh all table data • Last synced: ${lastSynced}`}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 transition active:scale-95 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Upload className="h-4 w-4" />
            <span>{t.import_excel}</span>
          </button>

          <button
            onClick={() => openCreateTableModal(selectedFolder || undefined)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>{t.create_table}</span>
          </button>
        </div>
      </div>

      {/* Workplace Folder Active Action Banner */}
      {selectedFolder && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  Folder: {selectedFolder}
                </span>
                <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {filtered.length} {filtered.length === 1 ? 'sheet' : 'sheets'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage all spreadsheets grouped under this Workplace folder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRenameFolderOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-amber-100/50 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition"
            >
              <FolderEdit className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Rename Folder</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteFolderOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 transition"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>Delete Folder</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid of Tables */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
              No spreadsheets found
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {query
                ? 'No tables match your search query.'
                : selectedFolder
                ? `No tables inside "${selectedFolder}". Click below to add a table here.`
                : 'Create a new table to get started.'}
            </p>
            <button
              onClick={() => openCreateTableModal(selectedFolder || undefined)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Create Table</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tbl, idx) => (
              <div
                key={tbl.id ? `list-${tbl.id}` : `list-tbl-${idx}`}
                id={`table-card-${tbl.id}`}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-blue-400 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-blue-500 dark:hover:bg-slate-900"
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
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              Updated: {new Date(tbl.updated_at).toLocaleDateString()}
                            </p>
                            {tbl.folder_name && (
                              <span
                                onClick={() => setSelectedFolder(tbl.folder_name || null)}
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
                    {/* Folder Open Last Opened Timestamp Badge */}
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

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
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

      {showImportModal && <ExcelImportModal onClose={() => setShowImportModal(false)} />}
      {movingTable && (
        <MoveFolderModal
          isOpen={Boolean(movingTable)}
          table={movingTable}
          onClose={() => setMovingTable(null)}
        />
      )}
      {isDeleteFolderOpen && selectedFolder && (
        <DeleteFolderModal
          isOpen={isDeleteFolderOpen}
          folderName={selectedFolder}
          tableCount={filtered.length}
          onClose={() => setIsDeleteFolderOpen(false)}
        />
      )}
      {isRenameFolderOpen && selectedFolder && (
        <RenameFolderModalGlobal
          isOpen={isRenameFolderOpen}
          initialFolderName={selectedFolder}
          onClose={() => setIsRenameFolderOpen(false)}
        />
      )}
    </div>
  );
};

