import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { dbService } from '../lib/db';
import { idb } from '../lib/indexedDb';
import { getSupabase } from '../lib/supabase';
import { translations, Language } from '../lib/i18n';
import { FolderPasswordModal } from '../components/FolderPasswordModal';
import {
  SpreadsheetTable,
  TableColumn,
  TableRow,
  ViewTab,
  UserSettings,
} from '../types';

interface AppContextType {
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;
  activeTableId: string | null;
  activeTable: SpreadsheetTable | null;
  tables: SpreadsheetTable[];
  isLoadingTables: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['en'];
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  isOnline: boolean;
  lastSynced: string;
  isSyncing: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  
  // Table operations
  loadTables: () => Promise<void>;
  refreshTables: () => Promise<void>;
  openTable: (tableId: string, forceBypassLock?: boolean) => Promise<void>;
  closeTable: () => void;
  createNewTable: (
    name?: string,
    cols?: Partial<TableColumn>[],
    folderName?: string,
    isBlank?: boolean
  ) => Promise<SpreadsheetTable>;
  renameTable: (tableId: string, newName: string) => Promise<void>;
  moveTableToFolder: (tableId: string, folderName?: string) => Promise<void>;
  duplicateTable: (tableId: string) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  deleteFolder: (folderName: string, mode?: 'trash_tables' | 'ungroup_tables') => Promise<void>;
  renameFolder: (oldFolderName: string, newFolderName: string) => Promise<void>;
  toggleFavorite: (tableId: string) => Promise<void>;
  refreshActiveTable: () => Promise<void>;
  manualSync: () => Promise<void>;
  refreshAllData: () => Promise<void>;
  syncMessage: string | null;
  setSyncMessage: (msg: string | null) => void;

  // Folder Navigation Filter State
  selectedFolder: string | null;
  setSelectedFolder: (folder: string | null) => void;

  // Global Create Table Modal with Blank & Manual Column Options
  isCreateTableModalOpen: boolean;
  openCreateTableModal: (initialFolder?: string) => void;
  closeCreateTableModal: () => void;
  createTableInitialFolder: string | undefined;

  // Row Write Pad & Row Save Methods
  insertRowWithData: (tableId: string, cellValues: Record<string, any>) => Promise<{ row: TableRow; cells: Record<string, any>; saveTime: string; isoTimestamp: string }>;
  updateRowData: (tableId: string, rowId: string, cellValues: Record<string, any>) => Promise<{ row: TableRow; cells: Record<string, any>; saveTime: string; isoTimestamp: string }>;

  // Row Text Size & Row Height Customization Methods
  updateActiveTableRowTextSize: (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl') => Promise<void>;
  updateActiveTableRowHeight: (height: number) => Promise<void>;

  // Folder & Table Password Security Methods
  unlockedTableIds: Set<string>;
  setTablePassword: (tableId: string, password: string, hint?: string, folderName?: string) => Promise<void>;
  removeTablePassword: (tableId: string) => Promise<void>;
  verifyAndUnlockTable: (tableId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  lookupTableSecurity: (tableId: string) => Promise<{ hasPassword: boolean; passwordHint?: string; folderName?: string; decodedPassword?: string | null }>;
  openPasswordModal: (table: SpreadsheetTable, mode: 'SET' | 'UNLOCK' | 'LOOKUP') => void;
  closePasswordModal: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [currentTab, setCurrentTab] = useState<ViewTab>('home');
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<SpreadsheetTable | null>(null);
  const [tables, setTables] = useState<SpreadsheetTable[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [language, setLanguageState] = useState<Language>('en');
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('light');

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSynced, setLastSynced] = useState<string>(new Date().toLocaleTimeString());
  const [isSyncing, setIsSyncing] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Track session-unlocked password-protected tables
  const [unlockedTableIds, setUnlockedTableIds] = useState<Set<string>>(new Set());

  // Folder navigation state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Create Table Modal State
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [createTableInitialFolder, setCreateTableInitialFolder] = useState<string | undefined>(undefined);

  const openCreateTableModal = (initialFolder?: string) => {
    setCreateTableInitialFolder(initialFolder || selectedFolder || undefined);
    setIsCreateTableModalOpen(true);
  };

  const closeCreateTableModal = () => {
    setIsCreateTableModalOpen(false);
    setCreateTableInitialFolder(undefined);
  };

  // Password Modal Global State
  const [passwordModalTable, setPasswordModalTable] = useState<SpreadsheetTable | null>(null);
  const [passwordModalMode, setPasswordModalMode] = useState<'SET' | 'UNLOCK' | 'LOOKUP'>('UNLOCK');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const activeTableIdRef = useRef<string | null>(null);
  activeTableIdRef.current = activeTableId;

  // Translations helper
  const t = translations[language] || translations.en;

  // Network online/offline listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      manualSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyTheme = (th: 'light' | 'dark' | 'system') => {
    setThemeState(th);
    const root = document.documentElement;
    if (th === 'dark' || (th === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const setTheme = (th: 'light' | 'dark' | 'system') => {
    applyTheme(th);
    if (user) {
      dbService.saveUserSettings({
        id: user.id,
        user_id: user.id,
        theme: th,
        language,
        primary_color: '#1e40af',
        table_header_color: '#2563eb',
      });
    }
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (user) {
      dbService.saveUserSettings({
        id: user.id,
        user_id: user.id,
        theme,
        language: lang,
        primary_color: '#1e40af',
        table_header_color: '#2563eb',
      });
    }
  };

  const sortByMostRecent = (arr: SpreadsheetTable[]) => {
    return [...arr].sort((a, b) => {
      const timeA = new Date(a.last_modified_date_time || a.last_opened_at || a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_modified_date_time || b.last_opened_at || b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  };

  const loadTables = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Load instantly from IndexedDB cache with deduplication
      const localCached = (await idb.getAll<SpreadsheetTable>('tables')).filter(
        (t) => !user.id || t.user_id === user.id
      );
      if (localCached.length > 0) {
        const uniqueMap = new Map<string, SpreadsheetTable>();
        for (const t of localCached) {
          if (t && t.id) uniqueMap.set(t.id, t);
        }
        setTables(sortByMostRecent(Array.from(uniqueMap.values())));
      }

      // 2. Load latest synced tables with deduplication
      const data = await dbService.getTables(user.id);
      if (data && data.length > 0) {
        const uniqueMap = new Map<string, SpreadsheetTable>();
        for (const t of data) {
          if (t && t.id) uniqueMap.set(t.id, t);
        }
        setTables(sortByMostRecent(Array.from(uniqueMap.values())));
      }
      setLastSynced(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Load tables failed:', err);
    } finally {
      setIsLoadingTables(false);
    }
  }, [user?.id]);

  // Keep latest references for event handlers to avoid reconnecting SSE on every render
  const loadTablesRef = useRef(loadTables);
  loadTablesRef.current = loadTables;

  const refreshActiveTable = useCallback(async () => {
    const currentId = activeTableIdRef.current;
    if (!currentId || !user?.id) return;
    const fullTable = await dbService.getTableDetail(currentId, user.id);
    if (fullTable) {
      setActiveTable(fullTable);
      setLastSynced(new Date().toLocaleTimeString());
    }
  }, [user?.id]);

  const refreshActiveTableRef = useRef(refreshActiveTable);
  refreshActiveTableRef.current = refreshActiveTable;

  // Load user settings on sign in
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (user?.id) {
      if (prevUserIdRef.current !== user.id) {
        prevUserIdRef.current = user.id;
        dbService.getUserSettings(user.id).then((settings: UserSettings) => {
          if (settings) {
            if (settings.language) setLanguageState(settings.language);
            if (settings.theme) applyTheme(settings.theme);
          }
        });
        loadTables();
      }
    } else {
      prevUserIdRef.current = null;
      setTables([]);
      setActiveTable(null);
      setActiveTableId(null);
    }
  }, [user?.id, loadTables]);

  // Central Server Real-time SSE Multi-Device Sync Listener
  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isDisposed = false;

    const connectSSE = () => {
      if (isDisposed) return;
      try {
        eventSource = new EventSource(`/api/sync/events/${encodeURIComponent(currentUserId)}`);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') return;

            // Ignore events originating from this device to prevent race conditions and rubber-banding
            const currentDeviceId = dbService.getDeviceId();
            if (data.originDeviceId && data.originDeviceId === currentDeviceId) {
              return;
            }

            // Immediate sync when another device changes or deletes columns, tables, rows, folders
            if (
              data.type === 'table_deleted' ||
              data.type === 'folder_deleted' ||
              data.type === 'folder_ungrouped' ||
              data.type === 'folder_renamed'
            ) {
              loadTablesRef.current();
              if (activeTableIdRef.current) {
                dbService.getTableDetail(activeTableIdRef.current, currentUserId).then((t) => {
                  if (!t) {
                    setActiveTable(null);
                    setActiveTableId(null);
                    setCurrentTab('all_tables');
                  } else {
                    setActiveTable(t);
                  }
                });
              }
            } else if (
              data.type === 'column_deleted' ||
              data.type === 'column_updated' ||
              data.type === 'row_deleted' ||
              data.type === 'row_updated'
            ) {
              if (activeTableIdRef.current) {
                refreshActiveTableRef.current();
              }
            } else if (data.type === 'sync' || data.type === 'data_pushed') {
              loadTablesRef.current();
              if (activeTableIdRef.current) {
                refreshActiveTableRef.current();
              }
            }
          } catch {
            // ignore parse error
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isDisposed) {
            // Reconnect after 3 seconds
            reconnectTimeout = setTimeout(connectSSE, 3000);
          }
        };
      } catch (err) {
        console.warn('SSE connection error:', err);
      }
    };

    connectSSE();

    // Fallback sync polling every 5 seconds & on tab visibility/focus
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        dbService.syncWithServer(currentUserId).then((changed) => {
          if (changed) {
            loadTablesRef.current();
            if (activeTableIdRef.current) {
              refreshActiveTableRef.current();
            }
          }
        });
      }
    }, 5000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTablesRef.current();
        if (activeTableIdRef.current) {
          refreshActiveTableRef.current();
        }
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      isDisposed = true;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, [user?.id]);

  // Supabase Realtime multi-device sync listener
  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const channel = supabase
        .channel(`realtime-user-${currentUserId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tables', filter: `user_id=eq.${currentUserId}` },
          () => {
            loadTablesRef.current();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'table_columns', filter: `user_id=eq.${currentUserId}` },
          () => {
            if (activeTableIdRef.current) {
              refreshActiveTableRef.current();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'table_rows', filter: `user_id=eq.${currentUserId}` },
          () => {
            if (activeTableIdRef.current) {
              refreshActiveTableRef.current();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cell_values', filter: `user_id=eq.${currentUserId}` },
          () => {
            if (activeTableIdRef.current) {
              refreshActiveTableRef.current();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${currentUserId}` },
          (payload: any) => {
            const newSettings = payload.new;
            if (newSettings?.language) setLanguageState(newSettings.language);
            if (newSettings?.theme) applyTheme(newSettings.theme);
          }
        )
        .subscribe();

      const handleRemoteChange = () => {
        loadTablesRef.current();
        if (activeTableIdRef.current) {
          refreshActiveTableRef.current();
        }
      };
      window.addEventListener('mad_supabase_remote_change', handleRemoteChange);

      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('mad_supabase_remote_change', handleRemoteChange);
      };
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }
  }, [user?.id]);

  const openPasswordModal = (table: SpreadsheetTable, mode: 'SET' | 'UNLOCK' | 'LOOKUP' = 'UNLOCK') => {
    setPasswordModalTable(table);
    setPasswordModalMode(mode);
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordModalTable(null);
  };

  const openTable = async (tableId: string, forceBypassLock = false) => {
    if (!user) return;
    setIsLoadingTables(true);
    try {
      const fullTable = await dbService.getTableDetail(tableId, user.id);
      if (fullTable) {
        // If table is locked with password and not unlocked in this session, require unlock first
        if (fullTable.is_password_protected && !forceBypassLock && !unlockedTableIds.has(tableId)) {
          openPasswordModal(fullTable, 'UNLOCK');
          setIsLoadingTables(false);
          return;
        }

        const now = new Date().toISOString();
        fullTable.last_opened_at = now;
        setActiveTable(fullTable);
        setActiveTableId(tableId);
        setCurrentTab('table_detail');
        // Update in-memory tables list with last_opened_at
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? { ...t, last_opened_at: now } : t))
        );
        // Persist last_opened_at
        dbService.recordTableOpened(tableId, user.id, now).catch(console.warn);
      }
    } finally {
      setIsLoadingTables(false);
    }
  };

  const closeTable = () => {
    setActiveTable(null);
    setActiveTableId(null);
    loadTables();
    setCurrentTab('home');
  };

  // -------------------------------------------------------------
  // ROW TEXT SIZE & HEIGHT CUSTOMIZATION METHODS
  // -------------------------------------------------------------
  const updateActiveTableRowTextSize = async (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl') => {
    if (!activeTable || !user) return;
    const updated = { ...activeTable, row_text_size: size };
    setActiveTable(updated);
    setTables((prev) => prev.map((t) => (t.id === activeTable.id ? { ...t, row_text_size: size } : t)));
    await dbService.updateTableRowTextSize(activeTable.id, size, user.id);
  };

  const updateActiveTableRowHeight = async (height: number) => {
    if (!activeTable || !user) return;
    const updated = { ...activeTable, row_height: height };
    setActiveTable(updated);
    setTables((prev) => prev.map((t) => (t.id === activeTable.id ? { ...t, row_height: height } : t)));
    await dbService.updateTableRowHeight(activeTable.id, height, user.id);
  };

  // -------------------------------------------------------------
  // ROW WRITE PAD & DATA SAVE METHODS
  // -------------------------------------------------------------
  const insertRowWithData = async (
    tableId: string,
    cellValues: Record<string, any>
  ): Promise<{ row: TableRow; cells: Record<string, any>; saveTime: string; isoTimestamp: string }> => {
    if (!user) throw new Error('Authentication required');
    const table = activeTable?.id === tableId ? activeTable : await dbService.getTableDetail(tableId, user.id);
    const nextRowNumber = (table?.rows?.length || 0) + 1;

    const result = await dbService.insertRowWithData(tableId, user.id, nextRowNumber, cellValues);
    if (activeTableId === tableId) {
      await refreshActiveTable();
    }
    // Update modified timestamp in tables list
    setTables((prev) =>
      sortByMostRecent(
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                updated_at: result.isoTimestamp,
                last_modified_date_time: result.isoTimestamp,
                last_change_method: 'Row WritePad Insert',
              }
            : t
        )
      )
    );
    return result;
  };

  const updateRowData = async (
    tableId: string,
    rowId: string,
    cellValues: Record<string, any>
  ): Promise<{ row: TableRow; cells: Record<string, any>; saveTime: string; isoTimestamp: string }> => {
    if (!user) throw new Error('Authentication required');
    const result = await dbService.updateRowData(tableId, rowId, user.id, cellValues);
    if (activeTableId === tableId) {
      await refreshActiveTable();
    }
    // Update modified timestamp in tables list
    setTables((prev) =>
      sortByMostRecent(
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                updated_at: result.isoTimestamp,
                last_modified_date_time: result.isoTimestamp,
                last_change_method: 'Row WritePad Save',
              }
            : t
        )
      )
    );
    return result;
  };

  // -------------------------------------------------------------
  // FOLDER & TABLE PASSWORD SECURITY METHODS
  // -------------------------------------------------------------
  const setTablePassword = async (
    tableId: string,
    password: string,
    hint?: string,
    folderName?: string
  ) => {
    if (!user) throw new Error('Authentication required');
    await dbService.setTablePassword(tableId, password, hint, folderName, user.id);
    
    // Automatically consider this table unlocked for the user who just set the password
    setUnlockedTableIds((prev) => new Set([...prev, tableId]));
    
    await loadTables();
    if (activeTableId === tableId) {
      await refreshActiveTable();
    }
  };

  const removeTablePassword = async (tableId: string) => {
    if (!user) throw new Error('Authentication required');
    await dbService.removeTablePassword(tableId, user.id);
    await loadTables();
    if (activeTableId === tableId) {
      await refreshActiveTable();
    }
  };

  const verifyAndUnlockTable = async (tableId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Authentication required' };
    const isValid = await dbService.verifyTablePassword(tableId, password, user.id);
    if (isValid) {
      setUnlockedTableIds((prev) => new Set([...prev, tableId]));
      // Open the unlocked table
      await openTable(tableId, true);
      return { success: true };
    }
    return { success: false, error: 'Incorrect password or PIN' };
  };

  const lookupTableSecurity = async (tableId: string) => {
    if (!user) return { hasPassword: false };
    return await dbService.lookupTablePassword(tableId, user.id);
  };

  const createNewTable = async (
    name?: string,
    cols?: Partial<TableColumn>[],
    folderName?: string,
    isBlank?: boolean
  ): Promise<SpreadsheetTable> => {
    if (!user) throw new Error('Must be signed in');
    const newTbl = await dbService.createTable(
      name || (isBlank ? 'Blank Spreadsheet' : 'Business Spreadsheet'),
      user.id,
      cols,
      folderName || selectedFolder || undefined,
      isBlank
    );
    // 1. Instantly update tables list in state
    setTables((prev) => [newTbl, ...prev.filter((t) => t.id !== newTbl.id)]);
    
    // 2. Instantly set as active open table
    setActiveTable(newTbl);
    setActiveTableId(newTbl.id);
    setCurrentTab('table_detail');
    setLastSynced(new Date().toLocaleTimeString());

    // 3. Background sync and ensure fresh detail is loaded
    dbService.getTableDetail(newTbl.id, user.id).then((fullTbl) => {
      if (fullTbl && activeTableIdRef.current === newTbl.id) {
        setActiveTable(fullTbl);
      }
    }).catch(console.warn);

    return newTbl;
  };

  const moveTableToFolder = async (tableId: string, folderName?: string) => {
    if (!user) return;
    await dbService.updateTableFolder(tableId, folderName, user.id);
    await loadTables();
    if (activeTableId === tableId) {
      await refreshActiveTable();
    }
  };

  const renameTable = async (tableId: string, newName: string) => {
    if (!user) return;
    await dbService.updateTableName(tableId, newName, user.id);
    await loadTables();
    if (activeTableId === tableId) {
      await refreshActiveTable();
    }
  };

  const duplicateTable = async (tableId: string) => {
    if (!user) return;
    const dup = await dbService.duplicateTable(tableId, user.id);
    if (dup) {
      await loadTables();
      await openTable(dup.id);
    }
  };

  const deleteTable = async (tableId: string) => {
    if (!user) return;
    await dbService.moveToTrash(tableId, user.id, profile?.full_name || user.email || 'User');
    if (activeTableId === tableId) {
      closeTable();
    }
    await loadTables();
  };

  const deleteFolder = async (folderName: string, mode: 'trash_tables' | 'ungroup_tables' = 'trash_tables') => {
    if (!user) return;
    const cleanFolder = folderName.trim();
    if (!cleanFolder) return;

    await dbService.deleteFolder(
      cleanFolder,
      user.id,
      mode,
      profile?.full_name || user.email || 'User'
    );

    if (selectedFolder && selectedFolder.trim().toLowerCase() === cleanFolder.toLowerCase()) {
      setSelectedFolder(null);
    }

    if (
      mode === 'trash_tables' &&
      activeTable &&
      (activeTable.folder_name || '').trim().toLowerCase() === cleanFolder.toLowerCase()
    ) {
      closeTable();
    }

    await loadTables();
  };

  const renameFolder = async (oldFolderName: string, newFolderName: string) => {
    if (!user) return;
    const cleanOld = oldFolderName.trim();
    const cleanNew = newFolderName.trim();
    if (!cleanOld || !cleanNew) return;

    await dbService.renameFolder(cleanOld, cleanNew, user.id);

    if (selectedFolder && selectedFolder.trim().toLowerCase() === cleanOld.toLowerCase()) {
      setSelectedFolder(cleanNew);
    }

    await loadTables();
    if (activeTable && (activeTable.folder_name || '').trim().toLowerCase() === cleanOld.toLowerCase()) {
      await refreshActiveTable();
    }
  };

  const toggleFavorite = async (tableId: string) => {
    if (!user) return;
    const target = tables.find((t) => t.id === tableId);
    if (target) {
      const nextFav = !target.favorite;
      await dbService.toggleFavorite(tableId, nextFav, user.id);
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, favorite: nextFav } : t)));
    }
  };

  const manualSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await loadTables();
      if (activeTableId) {
        await refreshActiveTable();
      }
      const timeStr = new Date().toLocaleTimeString();
      setLastSynced(timeStr);
    } finally {
      setIsSyncing(false);
    }
  };

  const refreshAllData = async () => {
    if (!user) return;
    setIsSyncing(true);
    setSyncMessage('Syncing all changes with cloud database...');
    try {
      await loadTables();
      if (activeTableId) {
        await refreshActiveTable();
      }
      const timeStr = new Date().toLocaleTimeString();
      setLastSynced(timeStr);
      setSyncMessage(`All tables & data refreshed (${timeStr})`);
      setTimeout(() => {
        setSyncMessage(null);
      }, 3000);
    } catch (err) {
      console.warn('Refresh all data failed:', err);
      setSyncMessage('Sync completed with local cache.');
      setTimeout(() => setSyncMessage(null), 2500);
    } finally {
      setIsSyncing(false);
    }
  };

  const appContextValue = useMemo(() => ({
    currentTab,
    setCurrentTab,
    activeTableId,
    activeTable,
    tables,
    isLoadingTables,
    language,
    setLanguage,
    t,
    theme,
    setTheme,
    isOnline,
    lastSynced,
    isSyncing,
    sidebarOpen,
    setSidebarOpen,
    searchQuery,
    setSearchQuery,
    loadTables,
    refreshTables: loadTables,
    openTable,
    closeTable,
    createNewTable,
    renameTable,
    moveTableToFolder,
    duplicateTable,
    deleteTable,
    deleteFolder,
    renameFolder,
    toggleFavorite,
    refreshActiveTable,
    manualSync,
    refreshAllData,
    syncMessage,
    setSyncMessage,
    selectedFolder,
    setSelectedFolder,
    isCreateTableModalOpen,
    openCreateTableModal,
    closeCreateTableModal,
    createTableInitialFolder,
    insertRowWithData,
    updateRowData,
    updateActiveTableRowTextSize,
    updateActiveTableRowHeight,
    unlockedTableIds,
    setTablePassword,
    removeTablePassword,
    verifyAndUnlockTable,
    lookupTableSecurity,
    openPasswordModal,
    closePasswordModal,
  }), [
    currentTab,
    activeTableId,
    activeTable,
    tables,
    isLoadingTables,
    language,
    t,
    theme,
    isOnline,
    lastSynced,
    isSyncing,
    sidebarOpen,
    searchQuery,
    loadTables,
    refreshActiveTable,
    syncMessage,
    selectedFolder,
    isCreateTableModalOpen,
    createTableInitialFolder,
    unlockedTableIds,
  ]);

  return (
    <AppContext.Provider value={appContextValue}>
      {children}

      {/* Global Folder & Table Password Security Modal */}
      {isPasswordModalOpen && passwordModalTable && (
        <FolderPasswordModal
          table={passwordModalTable}
          mode={passwordModalMode}
          isOpen={isPasswordModalOpen}
          onClose={closePasswordModal}
          onSuccess={() => {
            closePasswordModal();
          }}
        />
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
