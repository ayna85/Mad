import {
  SpreadsheetTable,
  TableColumn,
  TableRow,
  CellValue,
  TableVersion,
  BackupRecord,
  DeletedItem,
  AuditLog,
  UserSettings,
  UserProfile,
} from '../types';

const DB_NAME = 'mad_business_db';
const DB_VERSION = 4;

export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private isInitializing: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.isInitializing) return this.isInitializing;

    this.isInitializing = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        const stores = [
          'tables',
          'columns',
          'rows',
          'cells',
          'versions',
          'backups',
          'deleted_items',
          'audit_logs',
          'user_settings',
          'profiles',
          'mutation_queue',
          'auth_users',
        ];

        for (const storeName of stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            if (storeName === 'cells') {
              db.createObjectStore(storeName, { keyPath: ['row_id', 'column_id'] });
            } else if (storeName === 'mutation_queue') {
              db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            } else {
              db.createObjectStore(storeName, { keyPath: 'id' });
            }
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.isInitializing;
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`IndexedDB getAll error on ${storeName}:`, err);
      return [];
    }
  }

  async get<T>(storeName: string, key: any): Promise<T | undefined> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);

        let validKey = key;
        if (storeName === 'cells' && typeof key === 'string' && key.includes('_')) {
          const [rId, cId] = key.split('_');
          validKey = [rId, cId];
        }

        const request = store.get(validKey);

        request.onsuccess = () => {
          if (request.result !== undefined) {
            resolve(request.result);
          } else if (storeName === 'user_settings' || storeName === 'profiles') {
            // Secondary lookup fallback by user_id or id if direct key get returned undefined
            const allReq = store.getAll();
            allReq.onsuccess = () => {
              const items = allReq.result || [];
              const found = items.find((it: any) => it.id === key || it.user_id === key);
              resolve(found);
            };
            allReq.onerror = () => resolve(undefined);
          } else {
            resolve(undefined);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`IndexedDB get error on ${storeName}:`, err);
      return undefined;
    }
  }

  async put<T>(storeName: string, item: T): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        // Sanitize object and ensure all required key paths exist
        const sanitized: any = typeof item === 'object' && item !== null ? { ...item } : item;

        if (store.keyPath) {
          if (typeof store.keyPath === 'string') {
            const kp = store.keyPath;
            if (sanitized[kp] === undefined || sanitized[kp] === null) {
              if (kp === 'id') {
                sanitized.id = sanitized.user_id || sanitized.item_id || sanitized.table_id || crypto.randomUUID();
              } else if (kp === 'user_id') {
                sanitized.user_id = sanitized.id || crypto.randomUUID();
              } else {
                sanitized[kp] = crypto.randomUUID();
              }
            }
          } else if (Array.isArray(store.keyPath)) {
            // Compound key path, e.g. ['row_id', 'column_id']
            for (const kp of store.keyPath) {
              if (sanitized[kp] === undefined || sanitized[kp] === null) {
                sanitized[kp] = crypto.randomUUID();
              }
            }
          }
        }

        const request = store.put(sanitized);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn(`IndexedDB put failed for ${storeName}:`, request.error);
          resolve(); // Resolve safely without breaking UI flows
        };
      });
    } catch (err) {
      console.warn(`IndexedDB put error on ${storeName}:`, err);
    }
  }

  async delete(storeName: string, key: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        let validKey = key;
        if (storeName === 'cells' && typeof key === 'string' && key.includes('_')) {
          const [rId, cId] = key.split('_');
          validKey = [rId, cId];
        }

        const request = store.delete(validKey);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn(`IndexedDB delete error on ${storeName}:`, request.error);
          resolve();
        };
      });
    } catch (err) {
      console.warn(`IndexedDB delete error on ${storeName}:`, err);
    }
  }

  async deleteCellsByRow(rowId: string, tableId?: string): Promise<void> {
    try {
      const allCells = await this.getAll<CellValue>('cells');
      const toDelete = allCells.filter(
        (c) => c.row_id === rowId && (!tableId || c.table_id === tableId)
      );
      for (const cell of toDelete) {
        await this.delete('cells', [cell.row_id, cell.column_id]);
      }
    } catch (err) {
      console.warn('deleteCellsByRow error:', err);
    }
  }

  async deleteCellsByColumn(columnId: string, tableId?: string): Promise<void> {
    try {
      const allCells = await this.getAll<CellValue>('cells');
      const toDelete = allCells.filter(
        (c) => c.column_id === columnId && (!tableId || c.table_id === tableId)
      );
      for (const cell of toDelete) {
        await this.delete('cells', [cell.row_id, cell.column_id]);
      }
    } catch (err) {
      console.warn('deleteCellsByColumn error:', err);
    }
  }

  async deleteCellsByTable(tableId: string): Promise<void> {
    try {
      const allCells = await this.getAll<CellValue>('cells');
      const toDelete = allCells.filter((c) => c.table_id === tableId);
      for (const cell of toDelete) {
        await this.delete('cells', [cell.row_id, cell.column_id]);
      }
    } catch (err) {
      console.warn('deleteCellsByTable error:', err);
    }
  }

  async clear(storeName: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`IndexedDB clear error on ${storeName}:`, err);
    }
  }
}

export const idb = new IndexedDBManager();
