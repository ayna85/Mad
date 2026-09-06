import { getSupabase } from './supabase';
import { idb } from './indexedDb';
import { hashPassword, encodePasswordVault, decodePasswordVault } from './securityUtils';
import { getCurrentDeviceInfo } from './deviceDetector';
import {
  SpreadsheetTable,
  TableColumn,
  TableRow,
  CellValue,
  TableVersion,
  BackupRecord,
  DeletedItem,
  AuditLog,
  UserProfile,
  UserSettings,
  ColumnType,
  Workspace,
  WorkspaceMember,
} from '../types';

export class DatabaseService {
  private recentMutationTimestamps = new Map<string, number>();

  getDeviceId(): string {
    let devId = typeof localStorage !== 'undefined' ? localStorage.getItem('mad_client_device_id') : null;
    if (!devId) {
      devId = crypto.randomUUID();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mad_client_device_id', devId);
      }
    }
    return devId;
  }

  recordMutation(id?: string): void {
    const now = Date.now();
    if (id) {
      this.recentMutationTimestamps.set(id, now);
    }
    this.recentMutationTimestamps.set('__global__', now);
  }

  hasRecentMutation(id?: string, windowMs: number = 10000): boolean {
    const now = Date.now();
    if (id) {
      const ts = this.recentMutationTimestamps.get(id);
      if (ts && now - ts < windowMs) return true;
    }
    const globalTs = this.recentMutationTimestamps.get('__global__');
    if (globalTs && now - globalTs < 3000) return true;
    return false;
  }

  // -------------------------------------------------------------
  // DEVICE & BROWSER STAMPING HELPER
  // -------------------------------------------------------------
  async stampTableModification(
    tableId: string,
    userId: string,
    changeMethod: string
  ): Promise<SpreadsheetTable | null> {
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (!table) return null;
    const dev = getCurrentDeviceInfo();
    const now = new Date().toISOString();
    table.updated_at = now;
    table.last_modified_by_device = dev.deviceName;
    table.last_modified_by_browser = dev.browserName;
    table.last_modified_by_device_type = dev.deviceType;
    table.last_change_method = changeMethod;
    table.last_modified_date_time = now;
    await idb.put('tables', table);
    await this.pushToServer(userId, { tables: [table] });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('tables')
          .update({
            updated_at: now,
            last_modified_date_time: now,
            last_change_method: changeMethod,
            last_modified_by_device: dev.deviceName,
            last_modified_by_browser: dev.browserName,
            last_modified_by_device_type: dev.deviceType,
          })
          .eq('id', tableId);
      } catch (err) {
        console.warn('Supabase stampTableModification warning:', err);
      }
    }
    return table;
  }
  // -------------------------------------------------------------
  // CLOUD SERVER REAL-TIME MULTI-DEVICE SYNCHRONIZATION
  // -------------------------------------------------------------
  async syncWithServer(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      let hasMeaningfulChanges = false;
      // 1. Pull latest data from central server
      const res = await fetch(`/api/sync/pull/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();

        // Track all deleted IDs from server and local
        const deletedTableIds = new Set<string>();
        const deletedColIds = new Set<string>();
        const deletedRowIds = new Set<string>();

        if (data.deleted_items && Array.isArray(data.deleted_items)) {
          for (const d of data.deleted_items) {
            await idb.put('deleted_items', d);
            const targetId = d.item_id || d.id;
            if (d.item_type === 'table') deletedTableIds.add(targetId);
            else if (d.item_type === 'column') deletedColIds.add(targetId);
            else if (d.item_type === 'row') deletedRowIds.add(targetId);
          }
        }

        // Also retrieve local deleted_items
        const localDeleted = await idb.getAll<DeletedItem>('deleted_items');
        for (const d of localDeleted) {
          const targetId = d.item_id || d.id;
          if (d.item_type === 'table') deletedTableIds.add(targetId);
          else if (d.item_type === 'column') deletedColIds.add(targetId);
          else if (d.item_type === 'row') deletedRowIds.add(targetId);
        }

        // Purge deleted items completely from local IndexedDB
        for (const tId of deletedTableIds) {
          const existed = await idb.get('tables', tId);
          if (existed) {
            hasMeaningfulChanges = true;
            await idb.delete('tables', tId);
            await idb.deleteCellsByTable(tId);
          }
        }
        for (const cId of deletedColIds) {
          const existed = await idb.get('columns', cId);
          if (existed) {
            hasMeaningfulChanges = true;
            await idb.delete('columns', cId);
            await idb.deleteCellsByColumn(cId);
          }
        }
        for (const rId of deletedRowIds) {
          const existed = await idb.get('rows', rId);
          if (existed) {
            hasMeaningfulChanges = true;
            await idb.delete('rows', rId);
            await idb.deleteCellsByRow(rId);
          }
        }

        // Last-Write-Wins (LWW) merge for tables
        if (data.tables && Array.isArray(data.tables)) {
          for (const tbl of data.tables) {
            if (!deletedTableIds.has(tbl.id)) {
              const localTbl = await idb.get<SpreadsheetTable>('tables', tbl.id);
              if (localTbl) {
                const localTime = localTbl.updated_at ? new Date(localTbl.updated_at).getTime() : 0;
                const serverTime = tbl.updated_at ? new Date(tbl.updated_at).getTime() : 0;
                if (serverTime > localTime && !this.hasRecentMutation(tbl.id)) {
                  await idb.put('tables', tbl);
                  hasMeaningfulChanges = true;
                }
              } else {
                await idb.put('tables', tbl);
                hasMeaningfulChanges = true;
              }
            }
          }
        }

        // LWW merge for columns
        if (data.columns && Array.isArray(data.columns)) {
          for (const col of data.columns) {
            if (!deletedColIds.has(col.id) && !deletedTableIds.has(col.table_id)) {
              const localCol = await idb.get<TableColumn>('columns', col.id);
              if (localCol) {
                const localTime = localCol.updated_at ? new Date(localCol.updated_at).getTime() : 0;
                const serverTime = col.updated_at ? new Date(col.updated_at).getTime() : 0;
                if (serverTime > localTime && !this.hasRecentMutation(col.id)) {
                  await idb.put('columns', col);
                  hasMeaningfulChanges = true;
                }
              } else {
                await idb.put('columns', col);
                hasMeaningfulChanges = true;
              }
            }
          }
        }

        // LWW merge for rows
        if (data.rows && Array.isArray(data.rows)) {
          for (const r of data.rows) {
            if (!deletedRowIds.has(r.id) && !deletedTableIds.has(r.table_id)) {
              const localRow = await idb.get<TableRow>('rows', r.id);
              if (localRow) {
                const localTime = localRow.updated_at ? new Date(localRow.updated_at).getTime() : 0;
                const serverTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;
                if (serverTime > localTime && !this.hasRecentMutation(r.id)) {
                  await idb.put('rows', r);
                  hasMeaningfulChanges = true;
                }
              } else {
                await idb.put('rows', r);
                hasMeaningfulChanges = true;
              }
            }
          }
        }

        // LWW merge for cells
        if (data.cells && Array.isArray(data.cells)) {
          for (const c of data.cells) {
            if (
              !deletedTableIds.has(c.table_id) &&
              !deletedColIds.has(c.column_id) &&
              !deletedRowIds.has(c.row_id)
            ) {
              const cellKey = `${c.row_id}_${c.column_id}`;
              const localCell = await idb.get<CellValue>('cells', cellKey);
              if (localCell) {
                const localTime = localCell.updated_at ? new Date(localCell.updated_at).getTime() : 0;
                const serverTime = c.updated_at ? new Date(c.updated_at).getTime() : 0;
                if (serverTime > localTime && !this.hasRecentMutation(cellKey)) {
                  await idb.put('cells', c);
                  hasMeaningfulChanges = true;
                }
              } else {
                await idb.put('cells', c);
                hasMeaningfulChanges = true;
              }
            }
          }
        }

        if (data.versions && Array.isArray(data.versions)) {
          for (const v of data.versions) await idb.put('versions', v);
        }
        if (data.backups && Array.isArray(data.backups)) {
          for (const b of data.backups) await idb.put('backups', b);
        }
        if (data.audit_logs && Array.isArray(data.audit_logs)) {
          for (const a of data.audit_logs) await idb.put('audit_logs', a);
        }
      }

      // 2. Only push local active items that are truly non-deleted
      const localDeleted = await idb.getAll<DeletedItem>('deleted_items');
      const allKnownDeletedIds = new Set(localDeleted.map((d) => d.item_id || d.id));

      const localTables = await idb.getAll<SpreadsheetTable>('tables');
      const userTables = localTables.filter((t) => (!userId || t.user_id === userId) && !allKnownDeletedIds.has(t.id));
      const localCols = (await idb.getAll<TableColumn>('columns')).filter(
        (c) => !allKnownDeletedIds.has(c.id) && !allKnownDeletedIds.has(c.table_id)
      );
      const localRows = (await idb.getAll<TableRow>('rows')).filter(
        (r) => !allKnownDeletedIds.has(r.id) && !allKnownDeletedIds.has(r.table_id)
      );
      const localCells = (await idb.getAll<CellValue>('cells')).filter(
        (c) => !allKnownDeletedIds.has(c.table_id) && !allKnownDeletedIds.has(c.column_id) && !allKnownDeletedIds.has(c.row_id)
      );
      const localVersions = await idb.getAll<TableVersion>('versions');
      const localBackups = await idb.getAll<BackupRecord>('backups');
      const localAudit = await idb.getAll<AuditLog>('audit_logs');

      await this.pushToServer(userId, {
        tables: userTables,
        columns: localCols,
        rows: localRows,
        cells: localCells,
        versions: localVersions,
        backups: localBackups,
        deleted_items: localDeleted,
        audit_logs: localAudit,
      });

      return hasMeaningfulChanges;
    } catch (err) {
      console.warn('Server sync offline or transient error:', err);
      return false;
    }
  }

  async pushToServer(userId: string, partialData: Record<string, any>): Promise<void> {
    if (!userId) return;
    try {
      await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deviceId: this.getDeviceId(),
          ...partialData,
        }),
      });
    } catch (err) {
      console.warn('pushToServer network error:', err);
    }
  }

  private realtimeChannel: any = null;

  setupSupabaseRealtime(userId: string) {
    if (typeof window === 'undefined' || !userId) return;
    const supabase = getSupabase();
    if (!supabase) return;

    if (this.realtimeChannel) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch {}
      this.realtimeChannel = null;
    }

    this.realtimeChannel = supabase
      .channel(`mad_workspace_realtime_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const item = payload.new as any;
            if (item && item.user_id === userId) {
              await idb.put('tables', item);
              window.dispatchEvent(new CustomEvent('mad_supabase_remote_change', { detail: { table: 'tables', item } }));
            }
          } else if (payload.eventType === 'DELETE') {
            const item = payload.old as any;
            if (item?.id) {
              await idb.delete('tables', item.id);
              window.dispatchEvent(new CustomEvent('mad_supabase_remote_change', { detail: { table: 'tables', deletedId: item.id } }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cell_values' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const item = payload.new as any;
            if (item && item.user_id === userId) {
              await idb.put('cells', item);
              window.dispatchEvent(new CustomEvent('mad_supabase_remote_change', { detail: { table: 'cell_values', item } }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_columns' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const item = payload.new as any;
            if (item && item.user_id === userId) {
              await idb.put('columns', item);
              window.dispatchEvent(new CustomEvent('mad_supabase_remote_change', { detail: { table: 'table_columns', item } }));
            }
          } else if (payload.eventType === 'DELETE') {
            const item = payload.old as any;
            if (item?.id) {
              await idb.delete('columns', item.id);
              window.dispatchEvent(new CustomEvent('mad_supabase_remote_change', { detail: { table: 'table_columns', deletedId: item.id } }));
            }
          }
        }
      )
      .subscribe();
  }

  async getUserWorkspace(userId: string): Promise<Workspace | null> {
    if (!userId) return null;
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data: ownWs } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId)
        .limit(1);

      if (ownWs && ownWs.length > 0) {
        return ownWs[0];
      }

      const { data: memberWs } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(*)')
        .eq('user_id', userId)
        .limit(1);

      if (memberWs && memberWs.length > 0 && (memberWs[0] as any).workspaces) {
        return (memberWs[0] as any).workspaces;
      }
    } catch (err) {
      console.warn('getUserWorkspace error:', err);
    }
    return null;
  }

  // Load the user's existing Supabase workspace using "auth.uid()"
  // Sync: "Workspace → Tables → Columns → Rows → Cell Values"
  // Save permanent data in Supabase. IndexedDB serves only as an offline cache.
  // Never create duplicate accounts or duplicate workspaces.
  async syncSupabaseWorkspace(userId: string, userName?: string): Promise<{ workspace: Workspace | null; tablesCount: number }> {
    if (!userId) return { workspace: null, tablesCount: 0 };
    const supabase = getSupabase();
    if (!supabase) return { workspace: null, tablesCount: 0 };

    try {
      // 1. Workspace: Load or create single workspace for this auth.uid()
      let activeWorkspace = await this.getUserWorkspace(userId);

      if (!activeWorkspace) {
        const wsName = `${userName || 'My'} Workspace`;
        const { data: newWs, error: wsError } = await supabase
          .from('workspaces')
          .insert({
            name: wsName,
            owner_id: userId,
          })
          .select()
          .single();

        if (!wsError && newWs) {
          activeWorkspace = newWs;
          await supabase.from('workspace_members').upsert({
            workspace_id: newWs.id,
            user_id: userId,
            role: 'owner',
          }, { onConflict: 'workspace_id,user_id' });
        }
      }

      // 2. Tables: Load user's existing Supabase tables using auth.uid()
      const { data: sbTables, error: tErr } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (!tErr && sbTables) {
        for (const t of sbTables) {
          await idb.put('tables', {
            ...t,
            workspace_id: t.workspace_id || activeWorkspace?.id,
          });
        }

        const tableIds = sbTables.map((t) => t.id);
        if (tableIds.length > 0) {
          // 3. Columns
          const { data: sbCols } = await supabase
            .from('table_columns')
            .select('*')
            .in('table_id', tableIds)
            .order('position', { ascending: true });

          if (sbCols) {
            for (const c of sbCols) {
              await idb.put('columns', c);
            }
          }

          // 4. Rows
          const { data: sbRows } = await supabase
            .from('table_rows')
            .select('*')
            .in('table_id', tableIds)
            .order('row_number', { ascending: true });

          if (sbRows) {
            for (const r of sbRows) {
              await idb.put('rows', r);
            }
          }

          // 5. Cell Values
          const { data: sbCells } = await supabase
            .from('cell_values')
            .select('*')
            .in('table_id', tableIds);

          if (sbCells) {
            for (const cv of sbCells) {
              await idb.put('cells', cv);
            }
          }
        }

        // Setup real-time listener
        this.setupSupabaseRealtime(userId);

        return { workspace: activeWorkspace, tablesCount: sbTables.length };
      }

      return { workspace: activeWorkspace, tablesCount: 0 };
    } catch (err) {
      console.warn('syncSupabaseWorkspace error:', err);
      return { workspace: null, tablesCount: 0 };
    }
  }

  // -------------------------------------------------------------
  // TABLES
  // -------------------------------------------------------------
  async getTables(userId: string): Promise<SpreadsheetTable[]> {
    // 1. Get trash item IDs so deleted tables are never shown
    const trashItems = await idb.getAll<DeletedItem>('deleted_items');
    const trashTableIds = new Set(
      trashItems
        .filter((item) => item.item_type === 'table')
        .map((item) => item.item_id || item.id)
    );

    // 2. Get cached IndexedDB tables immediately for zero latency
    const localTables = (await idb.getAll<SpreadsheetTable>('tables')).filter(
      (t) => (!userId || t.user_id === userId) && !trashTableIds.has(t.id)
    );

    const tableMap = new Map<string, SpreadsheetTable>();
    for (const t of localTables) {
      if (t && t.id && !trashTableIds.has(t.id)) {
        tableMap.set(t.id, t);
      }
    }

    // 3. Supabase Cloud Query FIRST (Permanent data source)
    const supabase = getSupabase();
    if (supabase && userId) {
      try {
        const { data: sbTables, error } = await supabase
          .from('tables')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });

        if (!error && sbTables) {
          for (const tbl of sbTables) {
            if (tbl && tbl.id && !trashTableIds.has(tbl.id)) {
              await idb.put('tables', tbl);
              tableMap.set(tbl.id, tbl);
            }
          }
          return Array.from(tableMap.values()).sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at).getTime();
            const timeB = new Date(b.updated_at || b.created_at).getTime();
            return timeB - timeA;
          });
        }
      } catch (err) {
        console.warn('Supabase getTables failed, using cached tables:', err);
      }
    }

    // 4. Fallback when Supabase is not yet configured or offline
    if (userId && !supabase) {
      try {
        const res = await fetch(`/api/sync/pull/${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.tables && Array.isArray(data.tables)) {
            for (const tbl of data.tables) {
              if (tbl && tbl.id && !trashTableIds.has(tbl.id)) {
                await idb.put('tables', tbl);
                tableMap.set(tbl.id, tbl);
              }
            }
          }
        }
      } catch {}
    }

    return Array.from(tableMap.values()).sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });
  }

  async getTableDetail(tableId: string, userId: string): Promise<SpreadsheetTable | null> {
    const supabase = getSupabase();
    let table: SpreadsheetTable | null = null;
    let columns: TableColumn[] = [];
    let rows: TableRow[] = [];
    const cells: Record<string, any> = {};

    // 1. Fetch from local IndexedDB first for instant rendering
    const localTable = await idb.get<SpreadsheetTable>('tables', tableId);
    const allLocalCols = await idb.getAll<TableColumn>('columns');
    const localCols = allLocalCols.filter((c) => c.table_id === tableId).sort((a, b) => a.position - b.position);

    const allLocalRows = await idb.getAll<TableRow>('rows');
    const localRows = allLocalRows.filter((r) => r.table_id === tableId).sort((a, b) => a.row_number - b.row_number);

    const allLocalCells = await idb.getAll<CellValue>('cells');
    allLocalCells
      .filter((c) => c.table_id === tableId)
      .forEach((c) => {
        cells[`${c.row_id}_${c.column_id}`] = c.value;
      });

    if (localTable) {
      table = localTable;
      const colMap = new Map<string, TableColumn>();
      for (const c of localCols) {
        if (c && c.id) colMap.set(c.id, c);
      }
      columns = Array.from(colMap.values());

      const rowMap = new Map<string, TableRow>();
      for (const r of localRows) {
        if (r && r.id) rowMap.set(r.id, r);
      }
      rows = Array.from(rowMap.values());
    }

    // 2. Fetch fresh table detail directly from Central Server API (multi-device)
    if (userId) {
      try {
        const srvRes = await fetch(`/api/tables/${encodeURIComponent(tableId)}`);
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData && srvData.table) {
            // Get all known deleted items
            const localDeleted = await idb.getAll<DeletedItem>('deleted_items');
            const deletedColIds = new Set(
              localDeleted.filter((d) => d.item_type === 'column').map((d) => d.item_id || d.id)
            );
            const deletedRowIds = new Set(
              localDeleted.filter((d) => d.item_type === 'row').map((d) => d.item_id || d.id)
            );

            // LWW for table metadata
            const localTime = table?.updated_at ? new Date(table.updated_at).getTime() : 0;
            const serverTime = srvData.table.updated_at ? new Date(srvData.table.updated_at).getTime() : 0;
            if (serverTime >= localTime && !this.hasRecentMutation(tableId)) {
              table = srvData.table;
              await idb.put('tables', table);
            }

            if (srvData.columns && Array.isArray(srvData.columns)) {
              const activeSrvCols = srvData.columns.filter((c: any) => !deletedColIds.has(c.id));
              const srvColIds = new Set(activeSrvCols.map((c: any) => c.id));
              // Prune local columns deleted on other devices
              for (const lc of localCols) {
                if (!srvColIds.has(lc.id)) {
                  await idb.delete('columns', lc.id);
                  await idb.deleteCellsByColumn(lc.id, tableId);
                }
              }
              for (const col of activeSrvCols) {
                if (!this.hasRecentMutation(col.id)) {
                  await idb.put('columns', col);
                }
              }
              columns = activeSrvCols;
            }

            if (srvData.rows && Array.isArray(srvData.rows)) {
              const activeSrvRows = srvData.rows.filter((r: any) => !deletedRowIds.has(r.id));
              const srvRowIds = new Set(activeSrvRows.map((r: any) => r.id));
              for (const lr of localRows) {
                if (!srvRowIds.has(lr.id)) {
                  await idb.delete('rows', lr.id);
                  await idb.deleteCellsByRow(lr.id, tableId);
                }
              }
              for (const r of activeSrvRows) {
                if (!this.hasRecentMutation(r.id)) {
                  await idb.put('rows', r);
                }
              }
              rows = activeSrvRows;
            }

            if (srvData.cells && typeof srvData.cells === 'object') {
              for (const [k, val] of Object.entries(srvData.cells)) {
                const [rId, cId] = k.split('_');
                if (rId && cId && !deletedRowIds.has(rId) && !deletedColIds.has(cId)) {
                  if (!this.hasRecentMutation(k)) {
                    cells[k] = val;
                    await idb.put('cells', {
                      row_id: rId,
                      column_id: cId,
                      table_id: tableId,
                      user_id: userId,
                      value: val,
                      updated_at: srvData.server_time || new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Server getTableDetail fetch fallback to local:', err);
      }
    }

    // 2. Fetch from Supabase if connected and merge any missing/updated items
    if (supabase) {
      try {
        const { data: tblData } = await supabase.from('tables').select('*').eq('id', tableId).single();
        if (tblData) {
          table = { ...(table || {}), ...tblData } as SpreadsheetTable;
          await idb.put('tables', table);
        }

        const { data: colData } = await supabase
          .from('table_columns')
          .select('*')
          .eq('table_id', tableId)
          .order('position', { ascending: true });
        if (colData && colData.length > 0) {
          columns = colData;
          for (const c of colData) await idb.put('columns', c);
        }

        const { data: rowData } = await supabase
          .from('table_rows')
          .select('*')
          .eq('table_id', tableId)
          .order('row_number', { ascending: true });
        if (rowData && rowData.length > 0) {
          rows = rowData;
          for (const r of rowData) await idb.put('rows', r);
        }

        const { data: cellData } = await supabase.from('cell_values').select('*').eq('table_id', tableId);
        if (cellData && cellData.length > 0) {
          for (const c of cellData) {
            cells[`${c.row_id}_${c.column_id}`] = c.value;
            await idb.put('cells', c);
          }
        }
      } catch (err) {
        console.warn('Supabase getTableDetail error, using local data:', err);
      }
    }

    if (!table) return null;

    return {
      ...table,
      columns,
      rows,
      cells,
    };
  }

  async recordTableOpened(tableId: string, userId: string, timestamp?: string): Promise<void> {
    const now = timestamp || new Date().toISOString();
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (table) {
      table.last_opened_at = now;
      await idb.put('tables', table);
    }
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('tables').update({ last_opened_at: now }).eq('id', tableId);
      } catch (err) {
        console.warn('Failed recording last_opened_at on Supabase:', err);
      }
    }
  }

  async createTable(
    name: string,
    userId: string,
    initialColumns?: Partial<TableColumn>[],
    folderName?: string,
    isBlank?: boolean
  ): Promise<SpreadsheetTable> {
    const tableId = crypto.randomUUID();
    const now = new Date().toISOString();
    const dev = getCurrentDeviceInfo();

    const userWorkspace = await this.getUserWorkspace(userId);

    const newTable: SpreadsheetTable = {
      id: tableId,
      user_id: userId,
      workspace_id: userWorkspace?.id,
      name: name.trim() || 'Untitled Business Table',
      favorite: false,
      folder_name: folderName ? folderName.trim() : undefined,
      last_opened_at: now,
      created_at: now,
      updated_at: now,
      last_modified_by_device: dev.deviceName,
      last_modified_by_browser: dev.browserName,
      last_modified_by_device_type: dev.deviceType,
      last_change_method: 'Create Table',
      last_modified_date_time: now,
    };

    let defaultCols: TableColumn[];
    let defaultRows: TableRow[];
    let defaultCells: Record<string, any> = {};

    if (initialColumns && initialColumns.length > 0) {
      defaultCols = initialColumns.map((col, idx) => ({
        id: col.id || crypto.randomUUID(),
        table_id: tableId,
        user_id: userId,
        name: col.name || `Column ${idx + 1}`,
        type: col.type || 'text',
        width: col.width || 160,
        position: idx,
        formatting: col.formatting || {},
        styling: col.styling || {},
        formula: col.formula || '',
        created_at: now,
        updated_at: now,
      }));

      defaultRows = isBlank
        ? [
            { id: crypto.randomUUID(), table_id: tableId, user_id: userId, row_number: 1, created_at: now, updated_at: now },
          ]
        : [
            { id: crypto.randomUUID(), table_id: tableId, user_id: userId, row_number: 1, created_at: now, updated_at: now },
            { id: crypto.randomUUID(), table_id: tableId, user_id: userId, row_number: 2, created_at: now, updated_at: now },
          ];
    } else if (isBlank) {
      // 1-Click Blank Table with clean editable columns
      defaultCols = [
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Item / Name',
          type: 'text',
          width: 180,
          position: 0,
          styling: { bold: true },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Amount (ETB)',
          type: 'amount',
          width: 160,
          position: 1,
          formatting: { numberFormat: 'currency_etb' },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Date (Ethiopian)',
          type: 'date',
          width: 160,
          position: 2,
          formatting: { calendarSystem: 'ethiopian', dateFormat: 'ethiopian_dd_mm_yyyy' },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Notes',
          type: 'text',
          width: 200,
          position: 3,
          created_at: now,
          updated_at: now,
        },
      ];

      defaultRows = [
        { id: crypto.randomUUID(), table_id: tableId, user_id: userId, row_number: 1, created_at: now, updated_at: now },
      ];
    } else {
      // Default business template with Birr A, Paid A, Total A, Date, Status, Image
      defaultCols = [
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Birr A',
          type: 'amount',
          width: 170,
          position: 0,
          formatting: { numberFormat: 'currency_etb' },
          styling: { bold: true },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Paid A',
          type: 'amount',
          width: 170,
          position: 1,
          formatting: { numberFormat: 'currency_etb' },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Total A',
          type: 'formula',
          width: 180,
          position: 2,
          formula: 'Birr A - Paid A',
          formatting: { numberFormat: 'currency_etb' },
          styling: { bold: true, textColor: '#1e40af' },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Transaction Date',
          type: 'date',
          width: 160,
          position: 3,
          formatting: { calendarSystem: 'ethiopian', dateFormat: 'ethiopian_dd_mm_yyyy' },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Status',
          type: 'select',
          width: 140,
          position: 4,
          formatting: { selectOptions: ['Paid', 'Pending', 'Verified', 'Overdue'] },
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          table_id: tableId,
          user_id: userId,
          name: 'Receipt / Image',
          type: 'image',
          width: 150,
          position: 5,
          created_at: now,
          updated_at: now,
        },
      ];

      defaultRows = [
        { id: crypto.randomUUID(), table_id: tableId, user_id: userId, row_number: 1, created_at: now, updated_at: now },
        { id: crypto.randomUUID(), table_id: tableId, user_id: userId, row_number: 2, created_at: now, updated_at: now },
        { id: crypto.randomUUID(), table_id: tableId, user_id: userId, row_number: 3, created_at: now, updated_at: now },
      ];

      defaultCells = {
        [`${defaultRows[0].id}_${defaultCols[0].id}`]: 1000,
        [`${defaultRows[0].id}_${defaultCols[1].id}`]: 200,
        [`${defaultRows[0].id}_${defaultCols[3].id}`]: '25/12/2018',
        [`${defaultRows[0].id}_${defaultCols[4].id}`]: 'Paid',

        [`${defaultRows[1].id}_${defaultCols[0].id}`]: 2500,
        [`${defaultRows[1].id}_${defaultCols[1].id}`]: 500,
        [`${defaultRows[1].id}_${defaultCols[3].id}`]: '25/12/2018',
        [`${defaultRows[1].id}_${defaultCols[4].id}`]: 'Pending',

        [`${defaultRows[2].id}_${defaultCols[0].id}`]: 4200,
        [`${defaultRows[2].id}_${defaultCols[1].id}`]: 1200,
        [`${defaultRows[2].id}_${defaultCols[3].id}`]: '25/12/2018',
        [`${defaultRows[2].id}_${defaultCols[4].id}`]: 'Verified',
      };
    }

    // Save locally
    await idb.put('tables', newTable);
    for (const c of defaultCols) await idb.put('columns', c);
    for (const r of defaultRows) await idb.put('rows', r);
    for (const [k, val] of Object.entries(defaultCells)) {
      const [rId, cId] = k.split('_');
      await idb.put('cells', { row_id: rId, column_id: cId, table_id: tableId, user_id: userId, value: val });
    }

    // Save to Cloud Server Sync
    const cellList = Object.entries(defaultCells).map(([k, val]) => {
      const [rId, cId] = k.split('_');
      return { table_id: tableId, row_id: rId, column_id: cId, user_id: userId, value: val };
    });
    this.pushToServer(userId, {
      tables: [newTable],
      columns: defaultCols,
      rows: defaultRows,
      cells: cellList,
    });

    // Save to Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('tables').upsert(newTable, { onConflict: 'id' });
        if (defaultCols.length > 0) {
          await supabase.from('table_columns').upsert(defaultCols, { onConflict: 'id' });
        }
        if (defaultRows.length > 0) {
          await supabase.from('table_rows').upsert(defaultRows, { onConflict: 'id' });
        }
        const cellInserts = Object.entries(defaultCells).map(([k, val]) => {
          const [rId, cId] = k.split('_');
          return { table_id: tableId, row_id: rId, column_id: cId, user_id: userId, value: val };
        });
        if (cellInserts.length > 0) {
          await supabase.from('cell_values').upsert(cellInserts, { onConflict: 'row_id,column_id' });
        }
      } catch (err) {
        console.warn('Supabase table creation error:', err);
      }
    }

    await this.logAudit(userId, 'CREATE_TABLE', 'table', tableId, `Created table '${newTable.name}'`);

    return {
      ...newTable,
      columns: defaultCols,
      rows: defaultRows,
      cells: defaultCells,
    };
  }

  async updateTableName(tableId: string, name: string, userId: string): Promise<void> {
    this.recordMutation(tableId);
    const now = new Date().toISOString();
    const dev = getCurrentDeviceInfo();
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (table) {
      table.name = name;
      table.updated_at = now;
      table.last_modified_by_device = dev.deviceName;
      table.last_modified_by_browser = dev.browserName;
      table.last_modified_by_device_type = dev.deviceType;
      table.last_change_method = 'Rename Table';
      table.last_modified_date_time = now;
      await idb.put('tables', table);
      await this.pushToServer(userId, { tables: [table] });
    }

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('tables').update({ name, updated_at: now }).eq('id', tableId);
    }
    await this.logAudit(userId, 'RENAME_TABLE', 'table', tableId, `Renamed table to '${name}'`, {
      changeMethod: 'Rename Table',
      tableName: name,
      folderName: table?.folder_name,
    });
  }

  async updateTableFolder(tableId: string, folderName: string | undefined, userId: string): Promise<void> {
    this.recordMutation(tableId);
    const now = new Date().toISOString();
    const dev = getCurrentDeviceInfo();
    const cleanFolder = folderName ? folderName.trim() : undefined;
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (table) {
      table.folder_name = cleanFolder;
      table.updated_at = now;
      table.last_modified_by_device = dev.deviceName;
      table.last_modified_by_browser = dev.browserName;
      table.last_modified_by_device_type = dev.deviceType;
      table.last_change_method = 'Workplace Folder Move';
      table.last_modified_date_time = now;
      await idb.put('tables', table);
      await this.pushToServer(userId, { tables: [table] });
    }

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('tables').update({ folder_name: cleanFolder || null, updated_at: now }).eq('id', tableId);
    }
    await this.logAudit(userId, 'MOVE_TABLE_FOLDER', 'table', tableId, `Moved table '${table?.name || tableId}' to folder '${cleanFolder || 'Root / No Folder'}'`, {
      changeMethod: 'Workplace Folder Move',
      tableName: table?.name,
      folderName: cleanFolder,
    });
  }

  async renameTableWithFolder(tableId: string, name: string, folderName: string | undefined, userId: string): Promise<void> {
    this.recordMutation(tableId);
    const now = new Date().toISOString();
    const dev = getCurrentDeviceInfo();
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (table) {
      table.name = name;
      table.folder_name = folderName || undefined;
      table.updated_at = now;
      table.last_modified_by_device = dev.deviceName;
      table.last_modified_by_browser = dev.browserName;
      table.last_modified_by_device_type = dev.deviceType;
      table.last_change_method = 'Table & Folder Rename';
      table.last_modified_date_time = now;
      await idb.put('tables', table);
      await this.pushToServer(userId, { tables: [table] });
    }

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('tables').update({ name, folder_name: folderName || null, updated_at: now }).eq('id', tableId);
    }
    await this.logAudit(userId, 'RENAME_FOLDER_TABLE', 'table', tableId, `Updated table '${name}' (Folder: '${folderName || 'Default'}')`, {
      changeMethod: 'Table & Folder Rename',
      tableName: name,
      folderName: folderName,
    });
  }

  async toggleFavorite(tableId: string, favorite: boolean, userId: string): Promise<void> {
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (table) {
      table.favorite = favorite;
      await idb.put('tables', table);
      this.pushToServer(userId, { tables: [table] });
    }
    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('tables').update({ favorite }).eq('id', tableId);
    }
  }

  async saveTableMetadata(tableId: string, userId: string, updates: Partial<SpreadsheetTable>): Promise<void> {
    const now = new Date().toISOString();
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (table) {
      const updated = { ...table, ...updates, updated_at: now };
      await idb.put('tables', updated);
      this.pushToServer(userId, { tables: [updated] });
    }
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('tables').update({ ...updates, updated_at: now }).eq('id', tableId);
      } catch (err) {
        console.warn('Supabase update table metadata warning:', err);
      }
    }
  }

  // -------------------------------------------------------------
  // ROW TEXT SIZE & ROW HEIGHT CUSTOMIZATION METHODS
  // -------------------------------------------------------------
  async updateTableRowTextSize(
    tableId: string,
    rowTextSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl',
    userId: string
  ): Promise<void> {
    await this.saveTableMetadata(tableId, userId, { row_text_size: rowTextSize });
    await this.logAudit(userId, 'UPDATE_TEXT_SIZE', 'table', tableId, `Changed row text size to '${rowTextSize}'`);
  }

  async updateTableRowHeight(
    tableId: string,
    rowHeight: number,
    userId: string
  ): Promise<void> {
    await this.saveTableMetadata(tableId, userId, { row_height: rowHeight });
    await this.logAudit(userId, 'UPDATE_ROW_HEIGHT', 'table', tableId, `Adjusted row height to ${rowHeight}px`);
  }

  // -------------------------------------------------------------
  // FOLDER & TABLE PASSWORD SECURITY & LOOKUP METHODS
  // -------------------------------------------------------------
  async setTablePassword(
    tableId: string,
    password: string,
    hint: string | undefined,
    folderName: string | undefined,
    userId: string
  ): Promise<void> {
    const trimmedPass = password.trim();
    if (!trimmedPass) throw new Error('Password cannot be empty');

    const hashed = await hashPassword(trimmedPass);
    const recoveryVault = encodePasswordVault(trimmedPass);

    const updates: Partial<SpreadsheetTable> = {
      is_password_protected: true,
      password_hash: hashed,
      password_hint: hint?.trim() || undefined,
      password_recovery_key: recoveryVault,
      folder_name: folderName?.trim() || undefined,
    };

    await this.saveTableMetadata(tableId, userId, updates);
    await this.logAudit(userId, 'SET_TABLE_PASSWORD', 'table', tableId, 'Set folder/table security password protection');
  }

  async removeTablePassword(tableId: string, userId: string): Promise<void> {
    const updates: Partial<SpreadsheetTable> = {
      is_password_protected: false,
      password_hash: undefined,
      password_hint: undefined,
      password_recovery_key: undefined,
    };

    await this.saveTableMetadata(tableId, userId, updates);
    await this.logAudit(userId, 'REMOVE_TABLE_PASSWORD', 'table', tableId, 'Removed folder/table password protection');
  }

  async verifyTablePassword(tableId: string, passwordInput: string, userId: string): Promise<boolean> {
    const table = await this.getTableDetail(tableId, userId);
    if (!table || !table.is_password_protected || !table.password_hash) {
      return true; // Not protected
    }

    const hashedInput = await hashPassword(passwordInput.trim());
    return hashedInput === table.password_hash;
  }

  async lookupTablePassword(tableId: string, userId: string): Promise<{
    hasPassword: boolean;
    passwordHint?: string;
    folderName?: string;
    decodedPassword?: string | null;
  }> {
    const table = await this.getTableDetail(tableId, userId);
    if (!table || !table.is_password_protected) {
      return { hasPassword: false };
    }

    const decoded = table.password_recovery_key ? decodePasswordVault(table.password_recovery_key) : null;

    return {
      hasPassword: true,
      passwordHint: table.password_hint,
      folderName: table.folder_name,
      decodedPassword: decoded,
    };
  }

  async duplicateTable(tableId: string, userId: string): Promise<SpreadsheetTable | null> {
    const fullTable = await this.getTableDetail(tableId, userId);
    if (!fullTable) return null;

    const newName = `${fullTable.name} (Copy)`;
    const newTable = await this.createTable(newName, userId, fullTable.columns);

    // Copy rows and cells
    const now = new Date().toISOString();
    const rowMap: Record<string, string> = {};
    const colMap: Record<string, string> = {};

    (newTable.columns || []).forEach((newCol, idx) => {
      if (fullTable.columns && fullTable.columns[idx]) {
        colMap[fullTable.columns[idx].id] = newCol.id;
      }
    });

    const newRows: TableRow[] = (fullTable.rows || []).map((origRow, idx) => {
      const newRowId = crypto.randomUUID();
      rowMap[origRow.id] = newRowId;
      return {
        id: newRowId,
        table_id: newTable.id,
        user_id: userId,
        row_number: idx + 1,
        created_at: now,
        updated_at: now,
      };
    });

    const newCells: Record<string, any> = {};
    if (fullTable.cells) {
      for (const [k, val] of Object.entries(fullTable.cells)) {
        const [origRowId, origColId] = k.split('_');
        const targetRowId = rowMap[origRowId];
        const targetColId = colMap[origColId];
        if (targetRowId && targetColId) {
          newCells[`${targetRowId}_${targetColId}`] = val;
          await idb.put('cells', {
            row_id: targetRowId,
            column_id: targetColId,
            table_id: newTable.id,
            user_id: userId,
            value: val,
          });
        }
      }
    }

    for (const r of newRows) await idb.put('rows', r);

    const supabase = getSupabase();
    if (supabase && newRows.length > 0) {
      try {
        await supabase.from('table_rows').insert(newRows);
        const inserts = Object.entries(newCells).map(([k, val]) => {
          const [rId, cId] = k.split('_');
          return { table_id: newTable.id, row_id: rId, column_id: cId, user_id: userId, value: val };
        });
        if (inserts.length > 0) {
          await supabase.from('cell_values').insert(inserts);
        }
      } catch (err) {
        console.warn('Supabase duplicate error:', err);
      }
    }

    await this.logAudit(userId, 'DUPLICATE_TABLE', 'table', newTable.id, `Duplicated table '${fullTable.name}' to '${newName}'`);
    return { ...newTable, rows: newRows, cells: newCells };
  }

  // -------------------------------------------------------------
  // TRASH & DELETED ITEMS
  // -------------------------------------------------------------
  async moveToTrash(tableId: string, userId: string, userName: string): Promise<void> {
    this.recordMutation(tableId);
    const fullTable = await this.getTableDetail(tableId, userId);
    if (!fullTable) return;

    // Create automatic pre-destructive backup first
    await this.createBackup(tableId, userId, 'pre_destructive', `Auto backup before deleting table '${fullTable.name}'`);

    const deletedItem: DeletedItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      item_type: 'table',
      item_id: tableId,
      name: fullTable.name,
      original_location: 'Spreadsheets',
      snapshot: fullTable,
      deleted_by: userName || userId,
      deleted_at: new Date().toISOString(),
    };

    // Save to deleted_items
    await idb.put('deleted_items', deletedItem);
    await idb.delete('tables', tableId);
    await idb.deleteCellsByTable(tableId);

    // Immediately remove from server backend to prevent revival on sync
    try {
      const devId = this.getDeviceId();
      await fetch(`/api/tables/${encodeURIComponent(tableId)}?user_id=${encodeURIComponent(userId)}&originDeviceId=${encodeURIComponent(devId)}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Server delete table error:', err);
    }
    await this.pushToServer(userId, { deleted_items: [deletedItem] });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('deleted_items').insert(deletedItem);
        await supabase.from('tables').delete().eq('id', tableId);
      } catch (err) {
        console.warn('Supabase move to trash error:', err);
      }
    }

    await this.logAudit(userId, 'DELETE_TABLE', 'table', tableId, `Moved table '${fullTable.name}' to trash`);
  }

  // Delete an entire folder and all its spreadsheets or ungroup them
  async deleteFolder(
    folderName: string,
    userId: string,
    mode: 'trash_tables' | 'ungroup_tables' = 'trash_tables',
    userName?: string
  ): Promise<{ affectedCount: number }> {
    const cleanFolder = folderName.trim();
    if (!cleanFolder) return { affectedCount: 0 };

    const allTables = await idb.getAll<SpreadsheetTable>('tables');
    const folderTables = allTables.filter(
      (t) => (!userId || t.user_id === userId) && (t.folder_name || '').trim().toLowerCase() === cleanFolder.toLowerCase()
    );

    if (mode === 'trash_tables') {
      // 1. Move all tables in the folder to trash
      for (const tbl of folderTables) {
        await this.moveToTrash(tbl.id, userId, userName || userId);
      }

      // 2. Call server to delete folder and associated tables
      try {
        await fetch(`/api/folders/${encodeURIComponent(cleanFolder)}?user_id=${encodeURIComponent(userId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('Server delete folder error:', err);
      }

      await this.logAudit(
        userId,
        'DELETE_FOLDER',
        'folder',
        cleanFolder,
        `Deleted folder '${cleanFolder}' and moved ${folderTables.length} tables to trash`
      );
    } else {
      // Ungroup: Remove folder_name tag from all tables in this folder
      const now = new Date().toISOString();
      const updatedTables: SpreadsheetTable[] = [];

      for (const tbl of folderTables) {
        tbl.folder_name = undefined;
        tbl.updated_at = now;
        await idb.put('tables', tbl);
        updatedTables.push(tbl);
      }

      // Sync updated tables to server
      try {
        await fetch(`/api/folders/${encodeURIComponent(cleanFolder)}/ungroup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        console.warn('Server ungroup folder error:', err);
      }
      this.pushToServer(userId, { tables: updatedTables });

      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase
            .from('tables')
            .update({ folder_name: null, updated_at: now })
            .eq('user_id', userId)
            .ilike('folder_name', cleanFolder);
        } catch (err) {
          console.warn('Supabase ungroup folder error:', err);
        }
      }

      await this.logAudit(
        userId,
        'UNGROUP_FOLDER',
        'folder',
        cleanFolder,
        `Removed folder '${cleanFolder}' (ungrouped ${folderTables.length} tables to workplace)`
      );
    }

    return { affectedCount: folderTables.length };
  }

  // Rename a folder across all tables in the workspace
  async renameFolder(
    oldFolderName: string,
    newFolderName: string,
    userId: string
  ): Promise<{ affectedCount: number }> {
    const cleanOld = oldFolderName.trim();
    const cleanNew = newFolderName.trim();
    if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
      return { affectedCount: 0 };
    }

    const allTables = await idb.getAll<SpreadsheetTable>('tables');
    const folderTables = allTables.filter(
      (t) => (!userId || t.user_id === userId) && (t.folder_name || '').trim().toLowerCase() === cleanOld.toLowerCase()
    );

    const now = new Date().toISOString();
    const updatedTables: SpreadsheetTable[] = [];

    for (const tbl of folderTables) {
      tbl.folder_name = cleanNew;
      tbl.updated_at = now;
      await idb.put('tables', tbl);
      updatedTables.push(tbl);
    }

    // Call server to rename folder
    try {
      await fetch(`/api/folders/${encodeURIComponent(cleanOld)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newFolderName: cleanNew, userId }),
      });
    } catch (err) {
      console.warn('Server rename folder error:', err);
    }
    this.pushToServer(userId, { tables: updatedTables });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('tables')
          .update({ folder_name: cleanNew, updated_at: now })
          .eq('user_id', userId)
          .ilike('folder_name', cleanOld);
      } catch (err) {
        console.warn('Supabase rename folder error:', err);
      }
    }

    await this.logAudit(
      userId,
      'RENAME_FOLDER',
      'folder',
      cleanNew,
      `Renamed folder '${cleanOld}' to '${cleanNew}' across ${folderTables.length} tables`
    );

    return { affectedCount: folderTables.length };
  }

  async getTrashItems(userId: string): Promise<DeletedItem[]> {
    let items: DeletedItem[] = [];
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase.from('deleted_items').select('*').order('deleted_at', { ascending: false });
        if (data && Array.isArray(data)) items = data;
      } catch (err) {
        console.warn('Supabase fetch trash error:', err);
      }
    }
    if (items.length === 0) {
      items = await idb.getAll<DeletedItem>('deleted_items');
    }
    const filtered = items.filter((item) => !userId || item.user_id === userId);
    const itemMap = new Map<string, DeletedItem>();
    for (const item of filtered) {
      if (item && item.id && !itemMap.has(item.id)) {
        itemMap.set(item.id, item);
      }
    }
    return Array.from(itemMap.values());
  }

  async getDeletedItems(userId: string): Promise<DeletedItem[]> {
    return this.getTrashItems(userId);
  }

  async getTrashTables(userId: string): Promise<SpreadsheetTable[]> {
    const items = await this.getTrashItems(userId);
    const tableMap = new Map<string, SpreadsheetTable>();
    
    // Sort so newest deleted items take priority if multiple entries exist
    const sorted = items
      .filter((i) => i.item_type === 'table')
      .sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    for (const i of sorted) {
      const keyId = i.item_id || i.id;
      if (keyId && !tableMap.has(keyId)) {
        tableMap.set(keyId, {
          id: keyId,
          user_id: i.user_id,
          name: i.name,
          favorite: i.snapshot?.favorite || false,
          created_at: i.deleted_at,
          updated_at: i.deleted_at,
          deleted_at: i.deleted_at,
          columns: i.snapshot?.columns || [],
          rows: i.snapshot?.rows || [],
          cells: i.snapshot?.cells || {},
        });
      }
    }
    return Array.from(tableMap.values());
  }

  async restoreTable(tableIdOrTrashId: string, userId: string): Promise<void> {
    const items = await this.getTrashItems(userId);
    const targets = items.filter((i) => i.id === tableIdOrTrashId || i.item_id === tableIdOrTrashId);
    if (targets.length > 0) {
      for (const target of targets) {
        await this.restoreTrashItem(target.id, userId);
      }
    } else {
      await this.restoreTrashItem(tableIdOrTrashId, userId);
    }
    await this.syncWithServer(userId);
  }

  async permanentlyDeleteTable(tableIdOrTrashId: string, userId: string): Promise<void> {
    const items = await this.getTrashItems(userId);
    const targets = items.filter((i) => i.id === tableIdOrTrashId || i.item_id === tableIdOrTrashId);
    for (const target of targets) {
      await this.permanentlyDeleteTrashItem(target.id, userId);
    }
    await idb.delete('deleted_items', tableIdOrTrashId);
    try {
      await fetch(`/api/trash/table/${encodeURIComponent(tableIdOrTrashId)}`, { method: 'DELETE' });
      await fetch(`/api/trash/${encodeURIComponent(tableIdOrTrashId)}`, { method: 'DELETE' });
    } catch {}
  }

  async restoreTrashItem(trashId: string, userId: string): Promise<void> {
    let item = await idb.get<DeletedItem>('deleted_items', trashId);
    if (!item) {
      const allTrash = await this.getTrashItems(userId);
      item = allTrash.find((i) => i.id === trashId || i.item_id === trashId);
    }
    if (!item) return;

    const supabase = getSupabase();

    if (item.item_type === 'table') {
      let snap: SpreadsheetTable = item.snapshot;
      if (typeof snap === 'string') {
        try {
          snap = JSON.parse(snap);
        } catch {}
      }
      if (!snap) return;

      const restoredTable: SpreadsheetTable = {
        id: snap.id || item.item_id || trashId,
        user_id: snap.user_id || userId,
        name: snap.name || item.name || 'Restored Table',
        favorite: snap.favorite || false,
        folder_name: snap.folder_name,
        created_at: snap.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_modified_date_time: new Date().toISOString(),
        last_change_method: 'Restored from Trash',
      };

      await idb.put('tables', restoredTable);

      const restoredCols: TableColumn[] = [];
      if (snap.columns && Array.isArray(snap.columns)) {
        for (const col of snap.columns) {
          await idb.put('columns', col);
          restoredCols.push(col);
        }
      }

      const restoredRows: TableRow[] = [];
      if (snap.rows && Array.isArray(snap.rows)) {
        for (const row of snap.rows) {
          await idb.put('rows', row);
          restoredRows.push(row);
        }
      }

      const restoredCells: CellValue[] = [];
      if (snap.cells) {
        if (Array.isArray(snap.cells)) {
          for (const c of snap.cells) {
            await idb.put('cells', c);
            restoredCells.push(c);
          }
        } else {
          for (const [k, val] of Object.entries(snap.cells)) {
            const [rId, cId] = k.split('_');
            const cellObj: CellValue = {
              table_id: restoredTable.id,
              row_id: rId,
              column_id: cId,
              user_id: restoredTable.user_id,
              value: val,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await idb.put('cells', cellObj);
            restoredCells.push(cellObj);
          }
        }
      }

      // Immediately push restored table to central server
      try {
        await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            tables: [restoredTable],
            columns: restoredCols,
            rows: restoredRows,
            cells: restoredCells,
          }),
        });
      } catch (err) {
        console.warn('Server push restore error:', err);
      }

      // Remove from server trash
      try {
        await fetch(`/api/trash/table/${encodeURIComponent(restoredTable.id)}`, { method: 'DELETE' });
        await fetch(`/api/trash/${encodeURIComponent(trashId)}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Server remove trash error:', err);
      }

      // Supabase restoration
      if (supabase) {
        try {
          await supabase.from('tables').upsert(restoredTable);
          if (restoredCols.length) await supabase.from('table_columns').upsert(restoredCols);
          if (restoredRows.length) await supabase.from('table_rows').upsert(restoredRows);
          if (restoredCells.length) await supabase.from('cell_values').upsert(restoredCells);
          await supabase.from('deleted_items').delete().eq('id', trashId);
          await supabase.from('deleted_items').delete().eq('item_id', restoredTable.id);
        } catch (err) {
          console.warn('Supabase restore error:', err);
        }
      }

      // Clean up all local deleted_items matching this table
      const allLocalDeleted = await idb.getAll<DeletedItem>('deleted_items');
      for (const d of allLocalDeleted) {
        if (d.id === trashId || d.item_id === restoredTable.id || d.item_id === trashId) {
          await idb.delete('deleted_items', d.id);
        }
      }

      await this.stampTableModification(restoredTable.id, userId, 'Restore from Trash');
      await this.logAudit(userId, 'RESTORE_TABLE', 'table', restoredTable.id, `Restored table '${restoredTable.name}' from trash`, {
        tableName: restoredTable.name,
        folderName: restoredTable.folder_name,
        changeMethod: 'Restore from Trash',
      });
    } else if (item.item_type === 'column') {
      const col: TableColumn = item.snapshot?.column || item.snapshot;
      if (col) {
        await idb.put('columns', col);
        if (supabase) {
          try {
            await supabase.from('table_columns').upsert(col);
          } catch (err) {
            console.warn('Supabase restore column error:', err);
          }
        }
        if (item.snapshot?.cells && Array.isArray(item.snapshot.cells)) {
          for (const c of item.snapshot.cells) {
            await idb.put('cells', c);
          }
          if (supabase && item.snapshot.cells.length > 0) {
            try {
              await supabase.from('cell_values').upsert(item.snapshot.cells);
            } catch (err) {
              console.warn('Supabase restore column cells error:', err);
            }
          }
        }
      }
      if (supabase) {
        await supabase.from('deleted_items').delete().eq('id', trashId);
      }
      await idb.delete('deleted_items', trashId);
      await this.logAudit(userId, 'RESTORE_ITEM', item.item_type, item.item_id, `Restored column '${item.name}'`);
    } else if (item.item_type === 'row') {
      const row: TableRow = item.snapshot?.row || item.snapshot;
      if (row) {
        await idb.put('rows', row);
        if (supabase) {
          try {
            await supabase.from('table_rows').upsert(row);
          } catch (err) {
            console.warn('Supabase restore row error:', err);
          }
        }
        if (item.snapshot?.cells && Array.isArray(item.snapshot.cells)) {
          for (const c of item.snapshot.cells) {
            await idb.put('cells', c);
          }
          if (supabase && item.snapshot.cells.length > 0) {
            try {
              await supabase.from('cell_values').upsert(item.snapshot.cells);
            } catch (err) {
              console.warn('Supabase restore row cells error:', err);
            }
          }
        }
      }
      if (supabase) {
        await supabase.from('deleted_items').delete().eq('id', trashId);
      }
      await idb.delete('deleted_items', trashId);
      await this.logAudit(userId, 'RESTORE_ITEM', item.item_type, item.item_id, `Restored row '${item.name}'`);
    }

    await idb.delete('deleted_items', trashId);
  }

  async permanentlyDeleteTrashItem(trashId: string, userId: string): Promise<void> {
    await idb.delete('deleted_items', trashId);
    try {
      await fetch(`/api/trash/${encodeURIComponent(trashId)}`, { method: 'DELETE' });
    } catch {}
    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('deleted_items').delete().eq('id', trashId);
    }
    await this.logAudit(userId, 'PERMANENT_DELETE', 'trash', trashId, 'Permanently deleted item from trash');
  }

  // -------------------------------------------------------------
  // COLUMNS & ROWS CRUD
  // -------------------------------------------------------------
  async getColumns(tableId: string, userId: string): Promise<TableColumn[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('table_columns')
          .select('*')
          .eq('table_id', tableId)
          .order('position', { ascending: true });
        if (data && data.length > 0) return data;
      } catch (err) {
        console.warn('Supabase fetch columns error:', err);
      }
    }
    const allCols = await idb.getAll<TableColumn>('columns');
    return allCols
      .filter((c) => c.table_id === tableId && (!userId || c.user_id === userId))
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  async addColumn(tableId: string, userId: string, columnData: Partial<TableColumn>): Promise<TableColumn> {
    const colId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newCol: TableColumn = {
      id: colId,
      table_id: tableId,
      user_id: userId,
      name: columnData.name || 'New Column',
      type: columnData.type || 'text',
      width: columnData.width || 160,
      position: columnData.position !== undefined ? columnData.position : 999,
      formatting: columnData.formatting || {},
      styling: columnData.styling || {},
      formula: columnData.formula || '',
      created_at: now,
      updated_at: now,
    };

    await idb.put('columns', newCol);
    this.pushToServer(userId, { columns: [newCol] });

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('table_columns').insert(newCol);
    }

    await this.logAudit(userId, 'ADD_COLUMN', 'column', colId, `Added column '${newCol.name}' to table`);
    return newCol;
  }

  async updateColumn(colId: string, userId: string, updates: Partial<TableColumn>): Promise<void> {
    const col = await idb.get<TableColumn>('columns', colId);
    if (!col) return;

    const updatedCol = { ...col, ...updates, updated_at: new Date().toISOString() };
    await idb.put('columns', updatedCol);

    // Call server PUT endpoint to immediately persist column properties (color, currency, width, etc.)
    try {
      await fetch(`/api/columns/${encodeURIComponent(colId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates }),
      });
    } catch (err) {
      console.warn('Server updateColumn error:', err);
    }
    this.pushToServer(userId, { columns: [updatedCol] });

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('table_columns').update(updates).eq('id', colId);
    }

    await this.logAudit(userId, 'UPDATE_COLUMN', 'column', colId, `Updated column properties for '${updatedCol.name}'`);
  }

  async deleteColumn(colId: string, tableId: string, userId: string): Promise<void> {
    this.recordMutation(colId);
    const col = await idb.get<TableColumn>('columns', colId);
    if (!col) return;

    // 1. Fetch cells for this column to preserve them
    const allCells = await idb.getAll<CellValue>('cells');
    const columnCells = allCells.filter(c => c.column_id === colId && c.table_id === tableId);

    // 2. Automatically create pre-destructive backup
    await this.createBackup(
      tableId,
      userId,
      'pre_destructive',
      `Auto backup before deleting column '${col.name}'`
    );

    // 3. Save to deleted_items
    const deletedItem: DeletedItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      item_type: 'column',
      item_id: colId,
      name: col.name,
      original_location: `Table ${tableId}`,
      snapshot: { column: col, cells: columnCells },
      deleted_by: userId,
      deleted_at: new Date().toISOString(),
    };

    await idb.put('deleted_items', deletedItem);
    await idb.delete('columns', colId);
    await idb.deleteCellsByColumn(colId, tableId);

    // Call server DELETE endpoint immediately to remove from server memory and cell store
    try {
      const devId = this.getDeviceId();
      await fetch(`/api/columns/${encodeURIComponent(colId)}?user_id=${encodeURIComponent(userId)}&table_id=${encodeURIComponent(tableId)}&originDeviceId=${encodeURIComponent(devId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Server deleteColumn error:', err);
    }
    await this.pushToServer(userId, { deleted_items: [deletedItem] });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('deleted_items').insert(deletedItem);
        await supabase.from('table_columns').delete().eq('id', colId);
        await supabase.from('cell_values').delete().eq('column_id', colId);
      } catch (err) {
        console.warn('Supabase deleteColumn error:', err);
      }
    }

    await this.logAudit(userId, 'DELETE_COLUMN', 'column', colId, `Deleted column '${col.name}' from table`);
  }

  async duplicateColumn(colId: string, tableId: string, userId: string): Promise<TableColumn | null> {
    const col = await idb.get<TableColumn>('columns', colId);
    if (!col) return null;

    const newColName = `${col.name} (Copy)`;
    const newCol = await this.addColumn(tableId, userId, {
      name: newColName,
      type: col.type,
      width: col.width,
      position: (col.position || 0) + 1,
      formatting: col.formatting ? JSON.parse(JSON.stringify(col.formatting)) : {},
      styling: col.styling ? JSON.parse(JSON.stringify(col.styling)) : {},
      formula: col.formula || '',
    });

    // Duplicate cell values for all rows
    const allCells = await idb.getAll<CellValue>('cells');
    const colCells = allCells.filter(c => c.column_id === colId && c.table_id === tableId);
    
    const newCells: CellValue[] = [];
    for (const c of colCells) {
      const newCell: CellValue = {
        table_id: tableId,
        row_id: c.row_id,
        column_id: newCol.id,
        user_id: userId,
        value: c.value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await idb.put('cells', newCell);
      newCells.push(newCell);
    }

    const supabase = getSupabase();
    if (supabase && newCells.length > 0) {
      try {
        await supabase.from('cell_values').insert(newCells);
      } catch (err) {
        console.warn('Supabase duplicate column cells error:', err);
      }
    }

    await this.logAudit(userId, 'DUPLICATE_COLUMN', 'column', newCol.id, `Duplicated column '${col.name}' to '${newColName}'`);
    return newCol;
  }

  async moveColumn(tableId: string, colId: string, direction: 'left' | 'right', userId: string): Promise<TableColumn[]> {
    const cols = await this.getColumns(tableId, userId);
    const index = cols.findIndex(c => c.id === colId);
    if (index === -1) return cols;

    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cols.length) return cols;

    // Swap positions
    const tempPos = cols[index].position;
    cols[index].position = cols[targetIndex].position;
    cols[targetIndex].position = tempPos;

    // If positions were identical, normalize positions
    if (cols[index].position === cols[targetIndex].position) {
      cols.forEach((c, idx) => {
        c.position = idx;
      });
      const temp = cols[index];
      cols[index] = cols[targetIndex];
      cols[targetIndex] = temp;
      cols.forEach((c, idx) => {
        c.position = idx;
      });
    }

    for (const c of cols) {
      await this.updateColumn(c.id, userId, { position: c.position });
    }

    cols.sort((a, b) => (a.position || 0) - (b.position || 0));
    await this.logAudit(userId, 'MOVE_COLUMN', 'column', colId, `Moved column '${cols[targetIndex]?.name || colId}' ${direction}`);
    return cols;
  }

  async insertColumnAt(
    tableId: string,
    refColId: string,
    side: 'left' | 'right',
    columnData: Partial<TableColumn>,
    userId: string
  ): Promise<TableColumn> {
    const cols = await this.getColumns(tableId, userId);
    const refIndex = cols.findIndex(c => c.id === refColId);
    const targetIndex = refIndex === -1 ? cols.length : side === 'left' ? refIndex : refIndex + 1;

    // Shift positions
    for (let i = targetIndex; i < cols.length; i++) {
      cols[i].position = i + 1;
      await this.updateColumn(cols[i].id, userId, { position: cols[i].position });
    }

    const newCol = await this.addColumn(tableId, userId, {
      ...columnData,
      position: targetIndex,
    });

    await this.logAudit(
      userId,
      'INSERT_COLUMN',
      'column',
      newCol.id,
      `Inserted column '${newCol.name}' ${side} of reference column`
    );
    return newCol;
  }

  async changeColumnType(
    colId: string,
    tableId: string,
    newType: ColumnType,
    formatting: any,
    userId: string
  ): Promise<void> {
    const col = await idb.get<TableColumn>('columns', colId);
    if (!col) return;

    const oldType = col.type;
    await this.updateColumn(colId, userId, {
      type: newType,
      formatting: formatting || col.formatting || {},
    });

    // Migrate/reformat existing cell values for rows if converting to number/amount/date
    const allCells = await idb.getAll<CellValue>('cells');
    const colCells = allCells.filter(c => c.column_id === colId && c.table_id === tableId);

    for (const c of colCells) {
      let migratedVal = c.value;
      if (newType === 'number' || newType === 'amount') {
        if (typeof migratedVal === 'string') {
          const cleanNum = parseFloat(migratedVal.replace(/[^0-9.-]+/g, ''));
          migratedVal = isNaN(cleanNum) ? 0 : cleanNum;
        }
      } else if (newType === 'checkbox') {
        migratedVal = Boolean(migratedVal && migratedVal !== 'false' && migratedVal !== '0');
      } else if (newType === 'text') {
        migratedVal = String(migratedVal ?? '');
      }

      await this.updateCellValue(tableId, c.row_id, colId, userId, migratedVal);
    }

    await this.logAudit(
      userId,
      'CHANGE_COLUMN_TYPE',
      'column',
      colId,
      `Converted column '${col.name}' type from ${oldType} to ${newType}`
    );
  }

  async addRow(tableId: string, userId: string, rowNumber: number): Promise<TableRow> {
    const rowId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newRow: TableRow = {
      id: rowId,
      table_id: tableId,
      user_id: userId,
      row_number: rowNumber,
      created_at: now,
      updated_at: now,
    };

    await idb.put('rows', newRow);
    this.pushToServer(userId, { rows: [newRow] });

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('table_rows').insert(newRow);
    }

    return newRow;
  }

  // -------------------------------------------------------------
  // ROW WRITE PAD & ENHANCED ROW DATA SAVE METHOD
  // -------------------------------------------------------------
  async insertRowWithData(
    tableId: string,
    userId: string,
    rowNumber: number,
    cellValues: Record<string, any> // key: column_id -> value
  ): Promise<{ row: TableRow; cells: Record<string, any>; saveTime: string; isoTimestamp: string }> {
    const rowId = crypto.randomUUID();
    const now = new Date().toISOString();
    const saveTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newRow: TableRow = {
      id: rowId,
      table_id: tableId,
      user_id: userId,
      row_number: rowNumber,
      created_at: now,
      updated_at: now,
    };

    await idb.put('rows', newRow);

    const createdCells: Record<string, any> = {};
    const cellRecordsToPush: CellValue[] = [];

    for (const [colId, val] of Object.entries(cellValues)) {
      if (val !== undefined && val !== null && val !== '') {
        const key = `${rowId}_${colId}`;
        createdCells[key] = val;

        const cellRecord: CellValue = {
          table_id: tableId,
          row_id: rowId,
          column_id: colId,
          user_id: userId,
          value: val,
          created_at: now,
          updated_at: now,
        };

        await idb.put('cells', cellRecord);
        cellRecordsToPush.push(cellRecord);
      }
    }

    this.pushToServer(userId, { rows: [newRow], cells: cellRecordsToPush });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('table_rows').insert(newRow);
        if (cellRecordsToPush.length > 0) {
          await supabase.from('cell_values').upsert(cellRecordsToPush, { onConflict: 'row_id,column_id' });
        }
      } catch (err) {
        console.warn('Supabase insertRowWithData error:', err);
      }
    }

    await this.stampTableModification(tableId, userId, 'Row WritePad Insert');

    await this.logAudit(
      userId,
      'INSERT_ROW_PAD',
      'row',
      rowId,
      `Inserted row #${rowNumber} via Write Pad at ${saveTime}`,
      {
        changeMethod: 'Row WritePad Insert',
      }
    );

    return {
      row: newRow,
      cells: createdCells,
      saveTime,
      isoTimestamp: now,
    };
  }

  async updateRowData(
    tableId: string,
    rowId: string,
    userId: string,
    cellValues: Record<string, any> // key: column_id -> value
  ): Promise<{ row: TableRow; cells: Record<string, any>; saveTime: string; isoTimestamp: string }> {
    const now = new Date().toISOString();
    const saveTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const existingRow = await idb.get<TableRow>('rows', rowId);
    const updatedRow: TableRow = existingRow
      ? { ...existingRow, updated_at: now }
      : { id: rowId, table_id: tableId, user_id: userId, row_number: 1, created_at: now, updated_at: now };

    await idb.put('rows', updatedRow);

    const updatedCells: Record<string, any> = {};
    const cellRecordsToPush: CellValue[] = [];

    for (const [colId, val] of Object.entries(cellValues)) {
      const key = `${rowId}_${colId}`;
      updatedCells[key] = val;

      const cellRecord: CellValue = {
        table_id: tableId,
        row_id: rowId,
        column_id: colId,
        user_id: userId,
        value: val,
        updated_at: now,
      };

      await idb.put('cells', cellRecord);
      cellRecordsToPush.push(cellRecord);
    }

    this.pushToServer(userId, { rows: [updatedRow], cells: cellRecordsToPush });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('table_rows').update({ updated_at: now }).eq('id', rowId);
        if (cellRecordsToPush.length > 0) {
          await supabase.from('cell_values').upsert(cellRecordsToPush, { onConflict: 'row_id,column_id' });
        }
      } catch (err) {
        console.warn('Supabase updateRowData error:', err);
      }
    }

    await this.stampTableModification(tableId, userId, 'Row WritePad Save');

    await this.logAudit(
      userId,
      'UPDATE_ROW_PAD',
      'row',
      rowId,
      `Saved row #${updatedRow.row_number} via Write Pad at ${saveTime}`,
      {
        changeMethod: 'Row WritePad Save',
      }
    );

    return {
      row: updatedRow,
      cells: updatedCells,
      saveTime,
      isoTimestamp: now,
    };
  }

  async deleteRow(rowId: string, tableId: string, userId: string): Promise<void> {
    this.recordMutation(rowId);
    const row = await idb.get<TableRow>('rows', rowId);
    const allCells = await idb.getAll<CellValue>('cells');
    const rowCells = allCells.filter(c => c.row_id === rowId && c.table_id === tableId);

    if (row) {
      const deletedItem: DeletedItem = {
        id: crypto.randomUUID(),
        user_id: userId,
        item_type: 'row',
        item_id: rowId,
        name: `Row #${row.row_number}`,
        original_location: `Table ${tableId}`,
        snapshot: { row, cells: rowCells },
        deleted_by: userId,
        deleted_at: new Date().toISOString(),
      };
      await idb.put('deleted_items', deletedItem);
      await this.pushToServer(userId, { deleted_items: [deletedItem] });
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('deleted_items').insert(deletedItem);
        } catch (err) {
          console.warn('Supabase archive deleted row error:', err);
        }
      }
    }

    await idb.delete('rows', rowId);
    await idb.deleteCellsByRow(rowId, tableId);

    try {
      const devId = this.getDeviceId();
      await fetch(
        `/api/rows/${encodeURIComponent(rowId)}?user_id=${encodeURIComponent(userId)}&table_id=${encodeURIComponent(tableId)}&originDeviceId=${encodeURIComponent(devId)}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      console.warn('Server deleteRow error:', err);
    }

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('table_rows').delete().eq('id', rowId);
      await supabase.from('cell_values').delete().eq('row_id', rowId);
    }

    await this.stampTableModification(tableId, userId, 'Delete Row');

    await this.logAudit(userId, 'DELETE_ROW', 'row', rowId, `Deleted row from table`, {
      changeMethod: 'Delete Row',
    });
  }

  async updateCellValue(
    tableId: string,
    rowId: string,
    columnId: string,
    userId: string,
    value: any
  ): Promise<void> {
    this.recordMutation(`${rowId}_${columnId}`);
    const cellRecord = {
      table_id: tableId,
      row_id: rowId,
      column_id: columnId,
      user_id: userId,
      value,
      updated_at: new Date().toISOString(),
    };

    await idb.put('cells', cellRecord);
    await this.pushToServer(userId, { cells: [cellRecord] });

    // Update table stamp
    await this.stampTableModification(tableId, userId, 'Direct Cell Edit');

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('cell_values')
          .upsert(cellRecord, { onConflict: 'row_id,column_id' });
      } catch (err) {
        console.warn('Supabase cell update error:', err);
      }
    }
  }

  // -------------------------------------------------------------
  // VERSIONS & HISTORY
  // -------------------------------------------------------------
  async createVersion(
    tableId: string,
    userId: string,
    changeDescription: string,
    snapshot: any
  ): Promise<TableVersion> {
    const versions = await this.getVersions(tableId, userId);
    const versionNumber = (versions[0]?.version_number || 0) + 1;

    const newVersion: TableVersion = {
      id: crypto.randomUUID(),
      table_id: tableId,
      user_id: userId,
      version_number: versionNumber,
      snapshot,
      change_description: changeDescription,
      created_at: new Date().toISOString(),
    };

    await idb.put('versions', newVersion);

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('table_versions').insert(newVersion);
    }

    return newVersion;
  }

  async getAllVersions(userId: string): Promise<TableVersion[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('table_versions')
          .select('*')
          .order('created_at', { ascending: false });
        if (data && data.length > 0) return data;
      } catch (err) {
        console.warn('Supabase fetch all versions error:', err);
      }
    }

    const all = await idb.getAll<TableVersion>('versions');
    return all
      .filter((v) => !userId || v.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getVersions(tableId: string, userId: string): Promise<TableVersion[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('table_versions')
          .select('*')
          .eq('table_id', tableId)
          .order('version_number', { ascending: false });
        if (data) return data;
      } catch (err) {
        console.warn('Supabase fetch versions error:', err);
      }
    }

    const all = await idb.getAll<TableVersion>('versions');
    return all
      .filter((v) => v.table_id === tableId && (!userId || v.user_id === userId))
      .sort((a, b) => b.version_number - a.version_number);
  }

  async restoreVersion(tableId: string, versionId: string, userId: string): Promise<void> {
    const currentTable = await this.getTableDetail(tableId, userId);
    if (currentTable) {
      // Create new version of current state before restoring
      await this.createVersion(
        tableId,
        userId,
        `Snapshot before restoring version`,
        currentTable
      );
    }

    const allVers = await this.getAllVersions(userId);
    const version = allVers.find((v) => v.id === versionId) || (await idb.get<TableVersion>('versions', versionId));
    if (!version || !version.snapshot) return;

    const snap = typeof version.snapshot === 'string' ? JSON.parse(version.snapshot) : version.snapshot;
    const supabase = getSupabase();

    // 1. Delete all existing columns, rows, and cells for this table to prevent orphaned data
    const existingCols = await idb.getAll<TableColumn>('columns');
    for (const c of existingCols.filter((col) => col.table_id === tableId)) {
      await idb.delete('columns', c.id);
    }

    const existingRows = await idb.getAll<TableRow>('rows');
    for (const r of existingRows.filter((row) => row.table_id === tableId)) {
      await idb.delete('rows', r.id);
    }

    const existingCells = await idb.getAll<CellValue>('cells');
    for (const cell of existingCells.filter((cl) => cl.table_id === tableId)) {
      await idb.delete('cells', [cell.row_id, cell.column_id]);
    }

    if (supabase) {
      try {
        await supabase.from('cell_values').delete().eq('table_id', tableId);
        await supabase.from('table_rows').delete().eq('table_id', tableId);
        await supabase.from('table_columns').delete().eq('table_id', tableId);
      } catch (err) {
        console.warn('Supabase cleanup before version restore:', err);
      }
    }

    // 2. Put table metadata
    const restoredTableObj: SpreadsheetTable = {
      id: tableId,
      user_id: snap.user_id || userId,
      name: snap.name || currentTable?.name || 'Restored Spreadsheet',
      favorite: snap.favorite ?? false,
      folder_name: snap.folder_name,
      row_text_size: snap.row_text_size || 'sm',
      row_height: snap.row_height || 42,
      created_at: snap.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_modified_date_time: new Date().toISOString(),
      last_change_method: `Restore Version #${version.version_number}`,
    };
    await idb.put('tables', restoredTableObj);

    // 3. Put snapshot columns
    const restoredCols: TableColumn[] = [];
    if (snap.columns && Array.isArray(snap.columns)) {
      for (const col of snap.columns) {
        const cObj: TableColumn = { ...col, table_id: tableId, user_id: userId };
        await idb.put('columns', cObj);
        restoredCols.push(cObj);
      }
    }

    // 4. Put snapshot rows
    const restoredRows: TableRow[] = [];
    if (snap.rows && Array.isArray(snap.rows)) {
      for (const row of snap.rows) {
        const rObj: TableRow = { ...row, table_id: tableId, user_id: userId };
        await idb.put('rows', rObj);
        restoredRows.push(rObj);
      }
    }

    // 5. Put snapshot cells
    const restoredCells: CellValue[] = [];
    if (snap.cells) {
      if (Array.isArray(snap.cells)) {
        for (const c of snap.cells) {
          const cellObj: CellValue = { ...c, table_id: tableId, user_id: userId };
          await idb.put('cells', cellObj);
          restoredCells.push(cellObj);
        }
      } else {
        for (const [k, val] of Object.entries(snap.cells)) {
          const [rId, cId] = k.split('_');
          if (rId && cId) {
            const cellObj: CellValue = {
              table_id: tableId,
              row_id: rId,
              column_id: cId,
              user_id: userId,
              value: val,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await idb.put('cells', cellObj);
            restoredCells.push(cellObj);
          }
        }
      }
    }

    // 6. Supabase Upsert
    if (supabase) {
      try {
        await supabase.from('tables').upsert(restoredTableObj);
        if (restoredCols.length) await supabase.from('table_columns').upsert(restoredCols);
        if (restoredRows.length) await supabase.from('table_rows').upsert(restoredRows);
        if (restoredCells.length) await supabase.from('cell_values').upsert(restoredCells);
      } catch (err) {
        console.warn('Supabase restoreVersion sync error:', err);
      }
    }

    // 7. Push to server backend
    this.pushToServer(userId, {
      tables: [restoredTableObj],
      columns: restoredCols,
      rows: restoredRows,
      cells: restoredCells,
    });

    await this.stampTableModification(tableId, userId, `Restore Version #${version.version_number}`);

    // Create a new version reflecting the restore operation
    const freshDetail = await this.getTableDetail(tableId, userId);
    if (freshDetail) {
      await this.createVersion(
        tableId,
        userId,
        `Restored from Version #${version.version_number} (${restoredCols.length} cols, ${restoredRows.length} rows)`,
        freshDetail
      );
    }

    await this.logAudit(userId, 'RESTORE_VERSION', 'version', versionId, `Restored version #${version.version_number} with ${restoredRows.length} rows`, {
      changeMethod: `Restore Version #${version.version_number}`,
      tableName: restoredTableObj.name,
      folderName: restoredTableObj.folder_name,
    });
  }

  async restoreBackup(backupId: string, userId: string): Promise<SpreadsheetTable | null> {
    const allBks = await this.getBackups(userId);
    const backup = allBks.find((b) => b.id === backupId) || (await idb.get<BackupRecord>('backups', backupId));
    if (!backup || !backup.snapshot) return null;

    const snap = typeof backup.snapshot === 'string' ? JSON.parse(backup.snapshot) : backup.snapshot;
    const supabase = getSupabase();

    // Check if full system backup
    if (snap.tables && Array.isArray(snap.tables)) {
      for (const tbl of snap.tables) {
        if (tbl.id) {
          const tblSnapVersion = { snapshot: tbl, version_number: 1 };
          await this.restoreVersion(tbl.id, 'backup_full_' + tbl.id, userId);
        }
      }
      return null;
    }

    const tableId = snap.id || backup.table_id || crypto.randomUUID();

    // Clean up old table items
    const existingCols = await idb.getAll<TableColumn>('columns');
    for (const c of existingCols.filter((col) => col.table_id === tableId)) {
      await idb.delete('columns', c.id);
    }
    const existingRows = await idb.getAll<TableRow>('rows');
    for (const r of existingRows.filter((row) => row.table_id === tableId)) {
      await idb.delete('rows', r.id);
    }
    const existingCells = await idb.getAll<CellValue>('cells');
    for (const cell of existingCells.filter((cl) => cl.table_id === tableId)) {
      await idb.delete('cells', [cell.row_id, cell.column_id]);
    }

    if (supabase) {
      try {
        await supabase.from('cell_values').delete().eq('table_id', tableId);
        await supabase.from('table_rows').delete().eq('table_id', tableId);
        await supabase.from('table_columns').delete().eq('table_id', tableId);
      } catch (err) {
        console.warn('Supabase cleanup before backup restore:', err);
      }
    }

    const restoredTableObj: SpreadsheetTable = {
      id: tableId,
      user_id: snap.user_id || userId,
      name: snap.name || backup.table_name || 'Restored Backup',
      favorite: snap.favorite ?? false,
      folder_name: snap.folder_name,
      row_text_size: snap.row_text_size || 'sm',
      row_height: snap.row_height || 42,
      created_at: snap.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_modified_date_time: new Date().toISOString(),
      last_change_method: `Restored from Backup '${backup.table_name}'`,
    };
    await idb.put('tables', restoredTableObj);

    const restoredCols: TableColumn[] = [];
    if (snap.columns && Array.isArray(snap.columns)) {
      for (const col of snap.columns) {
        const cObj: TableColumn = { ...col, table_id: tableId, user_id: userId };
        await idb.put('columns', cObj);
        restoredCols.push(cObj);
      }
    }

    const restoredRows: TableRow[] = [];
    if (snap.rows && Array.isArray(snap.rows)) {
      for (const row of snap.rows) {
        const rObj: TableRow = { ...row, table_id: tableId, user_id: userId };
        await idb.put('rows', rObj);
        restoredRows.push(rObj);
      }
    }

    const restoredCells: CellValue[] = [];
    if (snap.cells) {
      if (Array.isArray(snap.cells)) {
        for (const c of snap.cells) {
          const cellObj: CellValue = { ...c, table_id: tableId, user_id: userId };
          await idb.put('cells', cellObj);
          restoredCells.push(cellObj);
        }
      } else {
        for (const [k, val] of Object.entries(snap.cells)) {
          const [rId, cId] = k.split('_');
          if (rId && cId) {
            const cellObj: CellValue = {
              table_id: tableId,
              row_id: rId,
              column_id: cId,
              user_id: userId,
              value: val,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await idb.put('cells', cellObj);
            restoredCells.push(cellObj);
          }
        }
      }
    }

    if (supabase) {
      try {
        await supabase.from('tables').upsert(restoredTableObj);
        if (restoredCols.length) await supabase.from('table_columns').upsert(restoredCols);
        if (restoredRows.length) await supabase.from('table_rows').upsert(restoredRows);
        if (restoredCells.length) await supabase.from('cell_values').upsert(restoredCells);
      } catch (err) {
        console.warn('Supabase restoreBackup error:', err);
      }
    }

    this.pushToServer(userId, {
      tables: [restoredTableObj],
      columns: restoredCols,
      rows: restoredRows,
      cells: restoredCells,
    });

    await this.stampTableModification(tableId, userId, `Restored from Backup`);
    await this.logAudit(userId, 'RESTORE_BACKUP', 'backup', backupId, `Restored backup '${backup.table_name}'`, {
      changeMethod: 'Restore Backup',
      tableName: restoredTableObj.name,
      folderName: restoredTableObj.folder_name,
    });

    return restoredTableObj;
  }

  async saveFullTableState(
    tableId: string,
    userId: string,
    columns: TableColumn[],
    rows: TableRow[],
    cells: Record<string, any>,
    changeDescription?: string
  ): Promise<{ saveTime: string; isoTimestamp: string; versionNumber: number }> {
    const now = new Date().toISOString();
    const saveTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 1. Save all columns
    const colsToSave: TableColumn[] = columns.map((col, idx) => ({
      ...col,
      position: col.position !== undefined ? col.position : idx,
      table_id: tableId,
      user_id: userId,
      updated_at: now,
    }));
    for (const c of colsToSave) {
      await idb.put('columns', c);
    }

    // 2. Save all rows
    const rowsToSave: TableRow[] = rows.map((r, idx) => ({
      ...r,
      row_number: r.row_number || idx + 1,
      table_id: tableId,
      user_id: userId,
      updated_at: now,
    }));
    for (const r of rowsToSave) {
      await idb.put('rows', r);
    }

    // 3. Save all cells
    const cellsToSave: CellValue[] = [];
    for (const [k, val] of Object.entries(cells)) {
      const [rId, cId] = k.split('_');
      if (rId && cId) {
        const cellObj: CellValue = {
          table_id: tableId,
          row_id: rId,
          column_id: cId,
          user_id: userId,
          value: val,
          updated_at: now,
        };
        await idb.put('cells', cellObj);
        cellsToSave.push(cellObj);
      }
    }

    // 4. Update Table Modification Stamp
    const table = await idb.get<SpreadsheetTable>('tables', tableId);
    if (table) {
      table.updated_at = now;
      table.last_modified_date_time = now;
      table.last_change_method = changeDescription || 'Spreadsheet Save All';
      await idb.put('tables', table);
    }

    // 5. Supabase sync
    const supabase = getSupabase();
    if (supabase) {
      try {
        if (table) await supabase.from('tables').upsert(table);
        if (colsToSave.length) await supabase.from('table_columns').upsert(colsToSave);
        if (rowsToSave.length) await supabase.from('table_rows').upsert(rowsToSave);
        if (cellsToSave.length) await supabase.from('cell_values').upsert(cellsToSave);
      } catch (err) {
        console.warn('Supabase saveFullTableState error:', err);
      }
    }

    // 6. Push to server
    this.pushToServer(userId, {
      tables: table ? [table] : [],
      columns: colsToSave,
      rows: rowsToSave,
      cells: cellsToSave,
    });

    // 7. Create table version for history & recovery
    const fullSnapshot: SpreadsheetTable = {
      ...(table || { id: tableId, user_id: userId, name: 'Spreadsheet', favorite: false, created_at: now, updated_at: now }),
      columns: colsToSave,
      rows: rowsToSave,
      cells,
    };
    const ver = await this.createVersion(
      tableId,
      userId,
      changeDescription || `Manual Save (${colsToSave.length} cols, ${rowsToSave.length} rows)`,
      fullSnapshot
    );

    await this.logAudit(
      userId,
      'SAVE_SPREADSHEET',
      'table',
      tableId,
      `Saved spreadsheet data (${rowsToSave.length} rows, ${colsToSave.length} columns) at ${saveTime}`,
      {
        changeMethod: changeDescription || 'Spreadsheet Save All',
        tableName: table?.name,
        folderName: table?.folder_name,
      }
    );

    return {
      saveTime,
      isoTimestamp: now,
      versionNumber: ver.version_number,
    };
  }

  // -------------------------------------------------------------
  // BACKUPS
  // -------------------------------------------------------------
  async createFullSystemBackup(userId: string, description?: string): Promise<BackupRecord> {
    const tables = await this.getTables(userId);
    const fullTables: SpreadsheetTable[] = [];
    for (const t of tables) {
      const detail = await this.getTableDetail(t.id, userId);
      if (detail) fullTables.push(detail);
    }

    const backup: BackupRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      table_name: `All Business Tables (${fullTables.length})`,
      backup_type: 'manual',
      snapshot: { tables: fullTables, count: fullTables.length },
      description: description || `Full business database backup created on ${new Date().toLocaleString()}`,
      created_at: new Date().toISOString(),
    };

    await idb.put('backups', backup);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('backups').insert(backup);
      } catch (err) {
        console.warn('Supabase full backup error:', err);
      }
    }

    await this.logAudit(userId, 'CREATE_FULL_BACKUP', 'backup', backup.id, backup.description);
    return backup;
  }
  async createBackup(
    tableId: string,
    userId: string,
    type: 'manual' | 'pre_destructive' | 'auto',
    description: string
  ): Promise<BackupRecord> {
    const tableData = await this.getTableDetail(tableId, userId);

    const backup: BackupRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      table_id: tableId,
      table_name: tableData?.name || 'Table',
      backup_type: type,
      snapshot: tableData,
      description: description || `Backup created on ${new Date().toLocaleString()}`,
      created_at: new Date().toISOString(),
    };

    await idb.put('backups', backup);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('backups').insert(backup);
      } catch (err) {
        console.warn('Supabase backup error:', err);
      }
    }

    await this.logAudit(userId, 'CREATE_BACKUP', 'backup', backup.id, description);
    return backup;
  }

  async getBackups(userId: string): Promise<BackupRecord[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase.from('backups').select('*').order('created_at', { ascending: false });
        if (data) return data;
      } catch (err) {
        console.warn('Supabase fetch backups error:', err);
      }
    }

    const all = await idb.getAll<BackupRecord>('backups');
    return all
      .filter((b) => !userId || b.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // -------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------
  async logAudit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    meta?: {
      changeMethod?: string;
      tableName?: string;
      folderName?: string;
    }
  ): Promise<void> {
    const dev = getCurrentDeviceInfo();
    const now = new Date().toISOString();
    const log: AuditLog = {
      id: crypto.randomUUID(),
      user_id: userId || 'anonymous',
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      created_at: now,
      browser_name: dev.browserName,
      browser_version: dev.browserVersion,
      device_name: dev.deviceName,
      device_type: dev.deviceType,
      os_name: dev.osName,
      change_method: meta?.changeMethod || action.replace(/_/g, ' '),
      table_name: meta?.tableName,
      folder_name: meta?.folderName,
    };

    await idb.put('audit_logs', log);
    this.pushToServer(userId, { audit_logs: [log] });

    const supabase = getSupabase();
    if (supabase && userId) {
      try {
        await supabase.from('audit_logs').insert(log);
      } catch {
        // silent fallback
      }
    }
  }

  async getAuditLogs(userId: string): Promise<AuditLog[]> {
    // 1. Get cached IndexedDB logs
    const allLocal = await idb.getAll<AuditLog>('audit_logs');
    const logsMap = new Map<string, AuditLog>();
    for (const log of allLocal) {
      if (log && log.id && (!userId || log.user_id === userId)) {
        logsMap.set(log.id, log);
      }
    }

    // 2. Query Supabase if available
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (data) {
          for (const item of data) {
            logsMap.set(item.id, item);
            await idb.put('audit_logs', item);
          }
        }
      } catch {}
    }

    return Array.from(logsMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);
  }

  // -------------------------------------------------------------
  // USER SETTINGS & PROFILES
  // -------------------------------------------------------------
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
        if (data) {
          const prof: UserProfile = { ...data, id: data.id || data.user_id || userId };
          await idb.put('profiles', prof);
          return prof;
        }
      } catch {}
    }
    const local = await idb.get<UserProfile>('profiles', userId);
    return local || null;
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    const sanitized: UserProfile = {
      ...profile,
      id: profile.id || profile.user_id,
      user_id: profile.user_id || profile.id,
    };
    await idb.put('profiles', sanitized);
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(sanitized, { onConflict: 'user_id' });
      } catch {}
    }
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    const defaultSettings: UserSettings = {
      id: userId,
      user_id: userId,
      theme: 'light',
      language: 'en',
      primary_color: '#1e40af',
      table_header_color: '#2563eb',
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
        if (data) {
          const settings: UserSettings = {
            ...defaultSettings,
            ...data,
            id: data.id || data.user_id || userId,
            user_id: userId,
          };
          await idb.put('user_settings', settings);
          return settings;
        }
      } catch {}
    }

    const local = await idb.get<UserSettings>('user_settings', userId);
    return local || defaultSettings;
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    const sanitized: UserSettings = {
      ...settings,
      id: settings.id || settings.user_id,
      user_id: settings.user_id || settings.id,
    };
    await idb.put('user_settings', sanitized);
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('user_settings').upsert(sanitized, { onConflict: 'user_id' });
      } catch {}
    }
  }

  // -------------------------------------------------------------
  // COMPLETE EXCEL DATASET IMPORT ENGINE (BATCHED & VALIDATED)
  // -------------------------------------------------------------
  async importExcelDataset(params: {
    userId: string;
    mode: 'new_table' | 'append' | 'replace';
    targetTableName?: string;
    existingTableId?: string;
    columns: { originalIndex: number; name: string; type: any }[];
    rawGrid: any[][];
    onProgress?: (p: {
      percent: number;
      message: string;
      rowsProcessed: number;
      totalRows: number;
      cellsProcessed: number;
    }) => void;
  }): Promise<{
    table: SpreadsheetTable;
    columnsCount: number;
    rowsCount: number;
    cellsCount: number;
  }> {
    const {
      userId,
      mode,
      targetTableName,
      existingTableId,
      columns,
      rawGrid,
      onProgress,
    } = params;

    const now = new Date().toISOString();
    const supabase = getSupabase();

    let targetTable: SpreadsheetTable;
    let finalColumns: TableColumn[] = [];

    onProgress?.({
      percent: 5,
      message: 'Initializing spreadsheet structure...',
      rowsProcessed: 0,
      totalRows: rawGrid.length,
      cellsProcessed: 0,
    });

    if (mode === 'new_table' || !existingTableId) {
      const tableId = crypto.randomUUID();
      targetTable = {
        id: tableId,
        user_id: userId,
        name: targetTableName?.trim() || 'Imported Excel Table',
        favorite: false,
        created_at: now,
        updated_at: now,
      };

      await idb.put('tables', targetTable);
      if (supabase) {
        const { error } = await supabase.from('tables').insert(targetTable);
        if (error) throw new Error(`Failed to create table in database: ${error.message}`);
      }

      // Create all columns
      finalColumns = columns.map((col, idx) => ({
        id: crypto.randomUUID(),
        table_id: targetTable.id,
        user_id: userId,
        name: col.name,
        type: col.type || 'text',
        width: 160,
        position: idx,
        formatting: col.type === 'amount' ? { numberFormat: 'currency_etb' } : {},
        styling: {},
        formula: '',
        created_at: now,
        updated_at: now,
      }));

      for (const col of finalColumns) {
        await idb.put('columns', col);
      }

      if (supabase && finalColumns.length > 0) {
        const { error } = await supabase.from('table_columns').insert(finalColumns);
        if (error) throw new Error(`Failed to create columns: ${error.message}`);
      }
    } else {
      // Existing table
      const existing = await this.getTableDetail(existingTableId, userId);
      if (!existing) throw new Error('Selected table not found.');
      targetTable = existing;

      if (mode === 'replace') {
        // Backup first
        await this.createBackup(
          existingTableId,
          userId,
          'pre_destructive',
          `Auto-backup before replacing data via Excel import`
        );

        // Delete existing cells and rows
        const allCells = await idb.getAll<CellValue>('cells');
        for (const c of allCells) {
          if (c.table_id === existingTableId) {
            await idb.delete('cells', `${c.row_id}_${c.column_id}`);
          }
        }
        const allRows = await idb.getAll<TableRow>('rows');
        for (const r of allRows) {
          if (r.table_id === existingTableId) {
            await idb.delete('rows', r.id);
          }
        }
        const allCols = await idb.getAll<TableColumn>('columns');
        for (const col of allCols) {
          if (col.table_id === existingTableId) {
            await idb.delete('columns', col.id);
          }
        }

        if (supabase) {
          await supabase.from('cell_values').delete().eq('table_id', existingTableId);
          await supabase.from('table_rows').delete().eq('table_id', existingTableId);
          await supabase.from('table_columns').delete().eq('table_id', existingTableId);
        }

        // Recreate columns
        finalColumns = columns.map((col, idx) => ({
          id: crypto.randomUUID(),
          table_id: targetTable.id,
          user_id: userId,
          name: col.name,
          type: col.type || 'text',
          width: 160,
          position: idx,
          formatting: col.type === 'amount' ? { numberFormat: 'currency_etb' } : {},
          styling: {},
          formula: '',
          created_at: now,
          updated_at: now,
        }));

        for (const col of finalColumns) {
          await idb.put('columns', col);
        }

        if (supabase && finalColumns.length > 0) {
          const { error } = await supabase.from('table_columns').insert(finalColumns);
          if (error) throw new Error(`Failed to create replacement columns: ${error.message}`);
        }
      } else {
        // Append mode: use existing columns, match by name or index
        finalColumns = existing.columns || [];
        // If Excel has more columns than existing table, add the missing ones
        if (columns.length > finalColumns.length) {
          const startPos = finalColumns.length;
          const missingCols: TableColumn[] = [];
          for (let i = startPos; i < columns.length; i++) {
            const newCol: TableColumn = {
              id: crypto.randomUUID(),
              table_id: targetTable.id,
              user_id: userId,
              name: columns[i].name,
              type: columns[i].type || 'text',
              width: 160,
              position: i,
              formatting: columns[i].type === 'amount' ? { numberFormat: 'currency_etb' } : {},
              styling: {},
              formula: '',
              created_at: now,
              updated_at: now,
            };
            missingCols.push(newCol);
            finalColumns.push(newCol);
            await idb.put('columns', newCol);
          }
          if (supabase && missingCols.length > 0) {
            await supabase.from('table_columns').insert(missingCols);
          }
        }
      }
    }

    // Map Excel column index -> database Column ID
    const colIdMap: Record<number, string> = {};
    columns.forEach((c, idx) => {
      const dbCol = finalColumns[idx] || finalColumns.find((fc) => fc.name === c.name);
      if (dbCol) {
        colIdMap[idx] = dbCol.id;
      }
    });

    onProgress?.({
      percent: 15,
      message: `Creating ${rawGrid.length} table rows in batches...`,
      rowsProcessed: 0,
      totalRows: rawGrid.length,
      cellsProcessed: 0,
    });

    // Determine starting row number
    let startRowNumber = 1;
    if (mode === 'append' && existingTableId) {
      const existingRows = (await this.getTableDetail(existingTableId, userId))?.rows || [];
      startRowNumber = existingRows.length + 1;
    }

    // Generate All TableRow objects
    const newRows: TableRow[] = [];
    const rowIdMap: Record<number, string> = {};

    for (let rIdx = 0; rIdx < rawGrid.length; rIdx++) {
      const rowId = crypto.randomUUID();
      rowIdMap[rIdx] = rowId;
      newRows.push({
        id: rowId,
        table_id: targetTable.id,
        user_id: userId,
        row_number: startRowNumber + rIdx,
        created_at: now,
        updated_at: now,
      });
    }

    // Insert Rows in safe batches of 150
    const ROW_BATCH_SIZE = 150;
    for (let i = 0; i < newRows.length; i += ROW_BATCH_SIZE) {
      const batch = newRows.slice(i, i + ROW_BATCH_SIZE);
      for (const r of batch) {
        await idb.put('rows', r);
      }
      if (supabase) {
        const { error } = await supabase.from('table_rows').insert(batch);
        if (error) {
          throw new Error(`Failed inserting rows batch (${i + 1} to ${i + batch.length}): ${error.message}`);
        }
      }

      const rowsDone = Math.min(i + ROW_BATCH_SIZE, newRows.length);
      const progressPercent = Math.round(15 + (rowsDone / newRows.length) * 35);
      onProgress?.({
        percent: progressPercent,
        message: `Rows imported: ${rowsDone} / ${newRows.length}`,
        rowsProcessed: rowsDone,
        totalRows: newRows.length,
        cellsProcessed: 0,
      });
    }

    // Prepare all CellValue objects (preserving empty / non-empty values at exact column indexes)
    const allCellRecords: CellValue[] = [];
    for (let rIdx = 0; rIdx < rawGrid.length; rIdx++) {
      const rowId = rowIdMap[rIdx];
      const rowData = rawGrid[rIdx];

      for (let cIdx = 0; cIdx < columns.length; cIdx++) {
        const colId = colIdMap[cIdx];
        if (!colId || !rowId) continue;

        const val = rowData[cIdx];
        // If value is not empty or null, record it
        if (val !== undefined && val !== null && val !== '') {
          allCellRecords.push({
            table_id: targetTable.id,
            row_id: rowId,
            column_id: colId,
            user_id: userId,
            value: val,
            created_at: now,
            updated_at: now,
          });
        }
      }
    }

    // Insert Cells in safe batches of 400
    const CELL_BATCH_SIZE = 400;
    for (let i = 0; i < allCellRecords.length; i += CELL_BATCH_SIZE) {
      const batch = allCellRecords.slice(i, i + CELL_BATCH_SIZE);
      for (const c of batch) {
        await idb.put('cells', c);
      }
      if (supabase) {
        const { error } = await supabase
          .from('cell_values')
          .upsert(batch, { onConflict: 'row_id,column_id' });
        if (error) {
          throw new Error(`Failed inserting cell values batch: ${error.message}`);
        }
      }

      const cellsDone = Math.min(i + CELL_BATCH_SIZE, allCellRecords.length);
      const progressPercent = Math.round(50 + (cellsDone / (allCellRecords.length || 1)) * 45);
      onProgress?.({
        percent: progressPercent,
        message: `Saving cells: ${cellsDone} / ${allCellRecords.length}`,
        rowsProcessed: newRows.length,
        totalRows: newRows.length,
        cellsProcessed: cellsDone,
      });
    }

    // Final Validation Check: Ensure columns & rows match
    const verifiedTable = await this.getTableDetail(targetTable.id, userId);
    const verifiedColCount = verifiedTable?.columns?.length || 0;
    const verifiedRowCount = verifiedTable?.rows?.length || 0;

    if (mode !== 'append' && (verifiedColCount < columns.length || verifiedRowCount < rawGrid.length)) {
      console.warn(
        `Import validation warning: Expected ${columns.length} cols and ${rawGrid.length} rows, verified ${verifiedColCount} cols and ${verifiedRowCount} rows.`
      );
    }

    // Sync newly imported table, columns, rows, cells to server
    try {
      await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tables: [targetTable],
          columns: finalColumns,
          rows: newRows,
          cells: allCellRecords,
        }),
      });
    } catch (err) {
      console.warn('Server push after Excel import error:', err);
    }

    await this.stampTableModification(targetTable.id, userId, 'Imported Excel Dataset');

    await this.logAudit(
      userId,
      'IMPORT_EXCEL',
      'table',
      targetTable.id,
      `Imported Excel sheet with ${columns.length} columns and ${rawGrid.length} rows into '${targetTable.name}'`
    );

    onProgress?.({
      percent: 100,
      message: 'Excel import completed successfully!',
      rowsProcessed: newRows.length,
      totalRows: newRows.length,
      cellsProcessed: allCellRecords.length,
    });

    return {
      table: verifiedTable || targetTable,
      columnsCount: verifiedColCount || columns.length,
      rowsCount: verifiedRowCount || newRows.length,
      cellsCount: allCellRecords.length,
    };
  }

  // -------------------------------------------------------------
  // SUPABASE STORAGE ASSETS & FILE MANAGEMENT
  // -------------------------------------------------------------
  async uploadImage(
    file: File,
    userId: string,
    tableId?: string,
    rowId?: string,
    columnId?: string
  ): Promise<{ publicUrl: string; storagePath: string }> {
    return this.uploadFileAsset({
      file,
      userId,
      tableId,
      rowId,
      columnId,
    });
  }

  async uploadFileAsset(params: {
    file: File;
    userId: string;
    tableId?: string;
    rowId?: string;
    columnId?: string;
  }): Promise<{ publicUrl: string; storagePath: string; id: string }> {
    const { file, userId, tableId, rowId, columnId } = params;
    const supabase = getSupabase();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${userId}/${Date.now()}_${cleanFileName}`;
    const fileId = crypto.randomUUID();
    let publicUrl = '';

    if (supabase) {
      // Try 'user_files' bucket first, fallback to 'mad-assets'
      let uploadResult = await supabase.storage.from('user_files').upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

      let bucketName = 'user_files';
      if (uploadResult.error) {
        uploadResult = await supabase.storage.from('mad-assets').upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        });
        bucketName = 'mad-assets';
      }

      if (!uploadResult.error && uploadResult.data) {
        const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        publicUrl = publicData.publicUrl;

        // Persist file metadata in public.file_assets
        const fileAssetRecord = {
          id: fileId,
          user_id: userId,
          table_id: tableId || null,
          row_id: rowId || null,
          column_id: columnId || null,
          storage_path: storagePath,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          public_url: publicUrl,
          created_at: new Date().toISOString(),
        };

        try {
          await supabase.from('file_assets').insert(fileAssetRecord);
        } catch (err) {
          console.warn('Failed saving file_asset metadata:', err);
        }

        await this.logAudit(userId, 'UPLOAD_FILE', 'file', storagePath, `Uploaded file '${file.name}'`);
        return { publicUrl, storagePath, id: fileId };
      }
    }

    // Offline / Local fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const localDataUrl = reader.result as string;
        resolve({
          id: fileId,
          publicUrl: localDataUrl,
          storagePath,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  async getFileAssets(userId: string, tableId?: string): Promise<any[]> {
    const supabase = getSupabase();
    if (supabase && userId) {
      try {
        let query = supabase.from('file_assets').select('*').eq('user_id', userId);
        if (tableId) {
          query = query.eq('table_id', tableId);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase fetch file_assets failed:', err);
      }
    }
    return [];
  }
}

export const dbService = new DatabaseService();
