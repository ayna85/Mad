export type ColumnType =
  | 'text'
  | 'number'
  | 'amount'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'formula'
  | 'image';

export type NumberFormatType =
  | 'normal'
  | 'comma'
  | '0_decimal'
  | '2_decimal'
  | '3_decimal'
  | 'custom_decimal'
  | 'custom'
  | 'currency_etb'
  | 'currency_usd'
  | 'currency_eur';

export type DateFormatType =
  | 'ethiopian_dd_mm_yyyy' // 25/12/2018
  | 'ethiopian_text' // 25 ነሐሴ 2018
  | 'ethiopian_iso' // 2018-12-25
  | 'gregorian_iso' // 2026-08-31
  | 'gregorian_slash' // 31/08/2026
  | 'gregorian_text'; // Aug 31, 2026

export interface ColumnStyle {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  bgColor?: string;
  textColor?: string;
}

export interface ColumnFormatting {
  numberFormat?: NumberFormatType;
  dateFormat?: DateFormatType;
  calendarSystem?: 'ethiopian' | 'gregorian';
  currencySymbol?: string;
  decimals?: number;
  selectOptions?: string[];
  prefix?: string;
  suffix?: string;
}

export interface TableColumn {
  id: string;
  table_id: string;
  user_id: string;
  name: string;
  type: ColumnType;
  width: number;
  position: number;
  formatting?: ColumnFormatting;
  styling?: ColumnStyle;
  formula?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TableRow {
  id: string;
  table_id: string;
  user_id: string;
  row_number: number;
  styling?: {
    bgColor?: string;
    textColor?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface CellValue {
  id?: string;
  table_id: string;
  row_id: string;
  column_id: string;
  user_id: string;
  value: any;
  created_at?: string;
  updated_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at?: string;
}

export interface SpreadsheetTable {
  id: string;
  workspace_id?: string;
  user_id: string;
  name: string;
  favorite: boolean;
  description?: string;
  folder_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  last_opened_at?: string;
  // Row Text Size & Height customization
  row_text_size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  row_height?: number;
  // Folder / Table Password Protection & Security Lookup
  is_password_protected?: boolean;
  password_hash?: string;
  password_hint?: string;
  password_recovery_key?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  cells?: Record<string, any>; // key: `${row_id}_${column_id}`
  // Device, Browser & Method Tracking for Multi-device Audit
  last_modified_by_device?: string; // e.g. "Apple iPhone", "Samsung Galaxy (Android)", "Windows PC", "MacBook Pro"
  last_modified_by_browser?: string; // e.g. "Opera Browser", "Google Chrome", "Apple Safari", "Microsoft Edge"
  last_modified_by_device_type?: 'phone' | 'tablet' | 'computer';
  last_change_method?: string; // e.g. "Direct Cell Edit", "Row WritePad", "Workplace Folder Move", "Excel Import", etc.
  last_modified_date_time?: string;
}

export interface TableVersion {
  id: string;
  table_id: string;
  user_id: string;
  version_number: number;
  snapshot: {
    table: Partial<SpreadsheetTable>;
    columns: TableColumn[];
    rows: TableRow[];
    cells: Record<string, any>;
  };
  change_description: string;
  created_at: string;
  // Device & Browser info
  browser_name?: string;
  device_name?: string;
  device_type?: 'phone' | 'tablet' | 'computer';
  change_method?: string;
}

export interface FileAsset {
  id: string;
  user_id: string;
  table_id?: string;
  row_id?: string;
  column_id?: string;
  storage_path: string;
  public_url?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  deleted_at?: string;
}

export interface DeletedItem {
  id: string;
  user_id: string;
  item_type: 'table' | 'row' | 'column' | 'file';
  item_id: string;
  name: string;
  original_location: string;
  snapshot: any;
  deleted_by: string;
  deleted_at: string;
}

export interface BackupRecord {
  id: string;
  user_id: string;
  table_id?: string;
  table_name?: string;
  backup_type: 'manual' | 'pre_destructive' | 'auto';
  snapshot: any;
  description: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
  details?: any;
  created_at: string;
  // Device & Browser Audit Tracking
  browser_name?: string;
  browser_version?: string;
  device_name?: string;
  device_type?: 'phone' | 'tablet' | 'computer';
  os_name?: string;
  change_method?: string;
  table_name?: string;
  folder_name?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
}

export interface LocalAuthUser {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  salt: string;
  created_at: string;
  updated_at?: string;
  last_login: string;
}

export interface UserSettings {
  id?: string;
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'am';
  primary_color: string;
  table_header_color: string;
  preferences?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface DeviceSession {
  id: string;
  user_id: string;
  browser_name: string; // e.g. "Opera", "Chrome", "Safari", "Firefox", "Edge"
  browser_version?: string;
  device_type: 'phone' | 'tablet' | 'computer';
  device_name: string; // e.g. "Samsung Galaxy (Android)", "iPhone 15 (iOS)", "Windows 11 PC", "MacBook Pro (macOS)"
  os_name: string;
  ip_address?: string;
  location?: string;
  is_current_device: boolean;
  created_at: string;
  last_active_at: string;
}

export type AppBackgroundTheme =
  | 'modern_slate'
  | 'midnight_mesh'
  | 'royal_azure'
  | 'emerald_fintech'
  | 'blueprint_graph'
  | 'obsidian_dark'
  | 'sunset_luxe';

export type ViewTab =
  | 'home'
  | 'all_tables'
  | 'recent'
  | 'favorites'
  | 'folders'
  | 'table_detail'
  | 'recovery'
  | 'trash'
  | 'backups'
  | 'settings'
  | 'account'
  | 'help'
  | 'admin_devices';

