import React, { useState, useMemo } from 'react';
import {
  Home,
  FileSpreadsheet,
  Clock,
  Star,
  RotateCcw,
  Trash2,
  Archive,
  Settings,
  User,
  HelpCircle,
  LogOut,
  X,
  PlusCircle,
  FolderOpen,
  FolderPlus,
  Palette,
  Shield,
  Folder,
  ChevronDown,
  ChevronRight,
  Layers,
  MoreVertical,
  FolderEdit,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ViewTab } from '../types';
import { MAD_PRODUCT_IMAGE } from '../assets/productImage';
import { CreateFolderModal } from './CreateFolderModal';
import { BackgroundCustomizerModal } from './BackgroundCustomizerModal';
import { DeleteFolderModal } from './DeleteFolderModal';
import { RenameFolderModalGlobal } from './RenameFolderModalGlobal';

export const Sidebar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    sidebarOpen,
    setSidebarOpen,
    t,
    tables,
    openCreateTableModal,
    selectedFolder,
    setSelectedFolder,
  } = useApp();
  const { signOut, profile, user } = useAuth();
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isFoldersMenuOpen, setIsFoldersMenuOpen] = useState(true);

  // Folder action modals state
  const [folderToDelete, setFolderToDelete] = useState<{ name: string; count: number } | null>(null);
  const [folderToRename, setFolderToRename] = useState<string | null>(null);
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null);

  // Extract unique folders
  const folderList = useMemo(() => {
    const map = new Map<string, number>();
    for (const tbl of tables) {
      if (tbl.folder_name && tbl.folder_name.trim()) {
        const fn = tbl.folder_name.trim();
        map.set(fn, (map.get(fn) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [tables]);

  const favoritesCount = useMemo(() => tables.filter((t) => t.favorite).length, [tables]);

  const navItems: {
    tab: ViewTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
  }[] = [
    { tab: 'home', label: t.nav_home, icon: Home },
    { tab: 'all_tables', label: t.nav_all_tables, icon: FileSpreadsheet, count: tables.length },
    { tab: 'recent', label: t.nav_recent, icon: Clock, count: Math.min(tables.length, 6) },
    { tab: 'favorites', label: t.nav_favorites, icon: Star, count: favoritesCount },
    { tab: 'admin_devices', label: 'Admin: Devices & Browsers', icon: Shield },
    { tab: 'recovery', label: t.nav_recovery, icon: RotateCcw },
    { tab: 'trash', label: t.nav_trash, icon: Trash2 },
    { tab: 'backups', label: t.nav_backups, icon: Archive },
    { tab: 'settings', label: t.nav_settings, icon: Settings },
    { tab: 'account', label: t.nav_account, icon: User },
    { tab: 'help', label: t.nav_help, icon: HelpCircle },
  ];

  const handleNavClick = (tab: ViewTab) => {
    setCurrentTab(tab);
    if (tab === 'all_tables' || tab === 'home') {
      setSelectedFolder(null);
    }
    setSidebarOpen(false);
  };

  const handleFolderClick = (folderName: string) => {
    setSelectedFolder(folderName);
    setCurrentTab('all_tables');
    setSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          id="sidebar-backdrop"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Drawer / Sidebar container */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Banner in Sidebar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <img
              src={MAD_PRODUCT_IMAGE}
              alt="MAD App Logo"
              className="h-7 w-7 rounded-lg object-cover shadow-xs border border-slate-200 dark:border-slate-700"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                MAD Sheets
              </span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">Miyawa 3A Multi-Sync</span>
            </div>
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Header / Quick Actions */}
        <div className="space-y-2 p-4 pt-3">
          <button
            id="btn-sidebar-new-table"
            onClick={() => {
              openCreateTableModal();
              setSidebarOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
          >
            <PlusCircle className="h-4 w-4" />
            <span>{t.create_table}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              id="btn-sidebar-create-folder"
              onClick={() => setIsFolderModalOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <FolderPlus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>New Folder</span>
            </button>

            <button
              id="btn-sidebar-bg-themes"
              onClick={() => setIsBgModalOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Palette className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Theme BG</span>
            </button>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-1">
          {/* Main Navigation items (Home, All Tables, Recent, Favorites) */}
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.tab && !selectedFolder;

            return (
              <button
                key={`nav-main-${item.tab}`}
                id={`nav-item-${item.tab}`}
                onClick={() => handleNavClick(item.tab)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Workplace / Folders Menu Section */}
          <div className="pt-3 pb-1">
            <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <button
                type="button"
                onClick={() => setIsFoldersMenuOpen(!isFoldersMenuOpen)}
                className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {isFoldersMenuOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>Workplace Folders</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(true)}
                className="text-[10px] lowercase text-blue-600 hover:underline dark:text-blue-400"
              >
                +new
              </button>
            </div>

            {isFoldersMenuOpen && (
              <div className="mt-1 space-y-0.5 pl-2">
                {folderList.length === 0 ? (
                  <p className="px-2 py-1.5 text-[11px] italic text-slate-400 dark:text-slate-500">
                    No folders yet
                  </p>
                ) : (
                  folderList.map((folder, idx) => {
                    const isSelected = selectedFolder === folder.name;
                    const isMenuOpen = openFolderMenu === folder.name;
                    return (
                      <div
                        key={`folder-row-${folder.name}-${idx}`}
                        className="group relative flex items-center justify-between rounded-lg"
                      >
                        <button
                          key={`folder-${folder.name}-${idx}`}
                          onClick={() => handleFolderClick(folder.name)}
                          className={`flex flex-1 items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                            isSelected
                              ? 'bg-blue-50 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="truncate">{folder.name}</span>
                          </div>
                          <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-500 group-hover:hidden dark:bg-slate-800 dark:text-slate-400">
                            {folder.count}
                          </span>
                        </button>

                        {/* Quick Action Button on Folder */}
                        <div className="relative">
                          <button
                            type="button"
                            title="Folder options"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFolderMenu(isMenuOpen ? null : folder.name);
                            }}
                            className={`rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${
                              isMenuOpen ? 'block bg-slate-200 text-slate-700 dark:bg-slate-700' : 'hidden group-hover:block'
                            }`}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div
                              className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl animate-in fade-in zoom-in-95 duration-100 dark:border-slate-800 dark:bg-slate-900"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleFolderClick(folder.name);
                                  setOpenFolderMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
                                <span>Open Folder ({folder.count})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFolderToRename(folder.name);
                                  setOpenFolderMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <FolderEdit className="h-3.5 w-3.5 text-amber-500" />
                                <span>Rename Folder</span>
                              </button>
                              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                              <button
                                type="button"
                                onClick={() => {
                                  setFolderToDelete({ name: folder.name, count: folder.count });
                                  setOpenFolderMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete Folder</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="py-1">
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
          </div>

          {/* Secondary Navigation items */}
          {navItems.slice(4).map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentTab === item.tab;

            return (
              <button
                key={`nav-sec-${item.tab}-${idx}`}
                id={`nav-item-${item.tab}`}
                onClick={() => handleNavClick(item.tab)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Cloud Sync Status Bottom Card */}
        <div className="mt-auto border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Cloud Syncing</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-[94%] rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            Manager: Abdii • Miyawa 3A
          </p>
        </div>
      </aside>

      {/* Workspace Create Folder Modal */}
      {isFolderModalOpen && (
        <CreateFolderModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
        />
      )}

      {/* Wallpaper Themes Customizer Modal */}
      {isBgModalOpen && (
        <BackgroundCustomizerModal
          isOpen={isBgModalOpen}
          onClose={() => setIsBgModalOpen(false)}
        />
      )}

      {/* Delete Folder Modal */}
      {folderToDelete && (
        <DeleteFolderModal
          isOpen={!!folderToDelete}
          folderName={folderToDelete.name}
          tableCount={folderToDelete.count}
          onClose={() => setFolderToDelete(null)}
        />
      )}

      {/* Rename Folder Global Modal */}
      {folderToRename && (
        <RenameFolderModalGlobal
          isOpen={!!folderToRename}
          initialFolderName={folderToRename}
          onClose={() => setFolderToRename(null)}
        />
      )}
    </>
  );
};

