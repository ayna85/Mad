export const SUPABASE_SQL_SCHEMA = `-- =============================================================
-- MAD Business Spreadsheet Application - Full Supabase Schema with RLS
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ DEFAULT now()
);

-- 2. Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Workspace Members Table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- 4. User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL UNIQUE,
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  primary_color TEXT DEFAULT '#1e40af',
  table_header_color TEXT DEFAULT '#2563eb',
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tables (Spreadsheets)
CREATE TABLE IF NOT EXISTS public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  name TEXT NOT NULL,
  favorite BOOLEAN DEFAULT false,
  description TEXT,
  folder_name TEXT,
  row_text_size TEXT DEFAULT 'sm',
  row_height INTEGER,
  is_password_protected BOOLEAN DEFAULT false,
  password_hash TEXT,
  password_hint TEXT,
  password_recovery_key TEXT,
  last_opened_at TIMESTAMPTZ DEFAULT now(),
  last_modified_date_time TIMESTAMPTZ DEFAULT now(),
  last_change_method TEXT,
  last_modified_by_device TEXT,
  last_modified_by_browser TEXT,
  last_modified_by_device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 6. Table Columns
CREATE TABLE IF NOT EXISTS public.table_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  width INTEGER DEFAULT 160,
  position INTEGER NOT NULL DEFAULT 0,
  formatting JSONB DEFAULT '{}'::jsonb,
  styling JSONB DEFAULT '{}'::jsonb,
  formula TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Table Rows
CREATE TABLE IF NOT EXISTS public.table_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  row_number INTEGER NOT NULL,
  styling JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Cell Values
CREATE TABLE IF NOT EXISTS public.cell_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE NOT NULL,
  row_id UUID REFERENCES public.table_rows(id) ON DELETE CASCADE NOT NULL,
  column_id UUID REFERENCES public.table_columns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (row_id, column_id)
);

-- 9. Table Versions
CREATE TABLE IF NOT EXISTS public.table_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. File Assets (Storage & Attachment metadata)
CREATE TABLE IF NOT EXISTS public.file_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE,
  row_id UUID REFERENCES public.table_rows(id) ON DELETE CASCADE,
  column_id UUID REFERENCES public.table_columns(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 11. Deleted Items (Trash & Recovery)
CREATE TABLE IF NOT EXISTS public.deleted_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  original_location TEXT,
  snapshot JSONB NOT NULL,
  deleted_by TEXT,
  deleted_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Backups
CREATE TABLE IF NOT EXISTS public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE,
  table_name TEXT,
  backup_type TEXT DEFAULT 'manual',
  snapshot JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  browser_name TEXT,
  browser_version TEXT,
  device_name TEXT,
  device_type TEXT,
  os_name TEXT,
  change_method TEXT,
  table_name TEXT,
  folder_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- -------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cell_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES USING auth.uid() & WORKSPACE ROLES
-- -------------------------------------------------------------

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are readable for lookup and accounts" ON public.profiles;
CREATE POLICY "Profiles are readable for lookup and accounts"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE
USING (auth.uid() = user_id);

-- Workspaces Policies
DROP POLICY IF EXISTS "Users can view workspaces they own or belong to" ON public.workspaces;
CREATE POLICY "Users can view workspaces they own or belong to"
ON public.workspaces FOR SELECT
USING (
  auth.uid() = owner_id OR
  id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create own workspace" ON public.workspaces;
CREATE POLICY "Users can create own workspace"
ON public.workspaces FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners and admins can update workspace" ON public.workspaces;
CREATE POLICY "Owners and admins can update workspace"
ON public.workspaces FOR UPDATE
USING (
  auth.uid() = owner_id OR
  id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor'))
);

DROP POLICY IF EXISTS "Owners can delete workspace" ON public.workspaces;
CREATE POLICY "Owners can delete workspace"
ON public.workspaces FOR DELETE
USING (auth.uid() = owner_id);

-- Workspace Members Policies
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;
CREATE POLICY "Users can view members of their workspaces"
ON public.workspace_members FOR SELECT
USING (
  user_id = auth.uid() OR
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Users or workspace owners can add members" ON public.workspace_members;
CREATE POLICY "Users or workspace owners can add members"
ON public.workspace_members FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Workspace owners can update members" ON public.workspace_members;
CREATE POLICY "Workspace owners can update members"
ON public.workspace_members FOR UPDATE
USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can leave or owners can remove members" ON public.workspace_members;
CREATE POLICY "Users can leave or owners can remove members"
ON public.workspace_members FOR DELETE
USING (
  user_id = auth.uid() OR
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
);

-- User Settings Policies
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings"
ON public.user_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tables Policies
DROP POLICY IF EXISTS "Users can view own or workspace tables" ON public.tables;
CREATE POLICY "Users can view own or workspace tables"
ON public.tables FOR SELECT
USING (
  user_id = auth.uid() OR
  (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own tables" ON public.tables;
CREATE POLICY "Users can insert own tables"
ON public.tables FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users and editors can update tables" ON public.tables;
CREATE POLICY "Users and editors can update tables"
ON public.tables FOR UPDATE
USING (
  user_id = auth.uid() OR
  (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
)
WITH CHECK (
  user_id = auth.uid() OR
  (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
);

DROP POLICY IF EXISTS "Users and admins can delete tables" ON public.tables;
CREATE POLICY "Users and admins can delete tables"
ON public.tables FOR DELETE
USING (
  user_id = auth.uid() OR
  (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')))
);

-- Table Columns Policies
DROP POLICY IF EXISTS "Users can view columns" ON public.table_columns;
CREATE POLICY "Users can view columns"
ON public.table_columns FOR SELECT
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can insert columns" ON public.table_columns;
CREATE POLICY "Users can insert columns"
ON public.table_columns FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

DROP POLICY IF EXISTS "Users can update columns" ON public.table_columns;
CREATE POLICY "Users can update columns"
ON public.table_columns FOR UPDATE
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

DROP POLICY IF EXISTS "Users can delete columns" ON public.table_columns;
CREATE POLICY "Users can delete columns"
ON public.table_columns FOR DELETE
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

-- Table Rows Policies
DROP POLICY IF EXISTS "Users can view rows" ON public.table_rows;
CREATE POLICY "Users can view rows"
ON public.table_rows FOR SELECT
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can insert rows" ON public.table_rows;
CREATE POLICY "Users can insert rows"
ON public.table_rows FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

DROP POLICY IF EXISTS "Users can update rows" ON public.table_rows;
CREATE POLICY "Users can update rows"
ON public.table_rows FOR UPDATE
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

DROP POLICY IF EXISTS "Users can delete rows" ON public.table_rows;
CREATE POLICY "Users can delete rows"
ON public.table_rows FOR DELETE
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

-- Cell Values Policies
DROP POLICY IF EXISTS "Users can view cell values" ON public.cell_values;
CREATE POLICY "Users can view cell values"
ON public.cell_values FOR SELECT
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can insert cell values" ON public.cell_values;
CREATE POLICY "Users can insert cell values"
ON public.cell_values FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

DROP POLICY IF EXISTS "Users can update cell values" ON public.cell_values;
CREATE POLICY "Users can update cell values"
ON public.cell_values FOR UPDATE
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

DROP POLICY IF EXISTS "Users can delete cell values" ON public.cell_values;
CREATE POLICY "Users can delete cell values"
ON public.cell_values FOR DELETE
USING (
  user_id = auth.uid() OR
  table_id IN (
    SELECT id FROM public.tables WHERE user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')))
  )
);

-- Table Versions Policies
DROP POLICY IF EXISTS "Users can manage own versions" ON public.table_versions;
CREATE POLICY "Users can manage own versions"
ON public.table_versions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- File Assets Policies
DROP POLICY IF EXISTS "Users can manage own file assets" ON public.file_assets;
CREATE POLICY "Users can manage own file assets"
ON public.file_assets FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Deleted Items Policies
DROP POLICY IF EXISTS "Users can manage own deleted items" ON public.deleted_items;
CREATE POLICY "Users can manage own deleted items"
ON public.deleted_items FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Backups Policies
DROP POLICY IF EXISTS "Users can manage own backups" ON public.backups;
CREATE POLICY "Users can manage own backups"
ON public.backups FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Audit Logs Policies
DROP POLICY IF EXISTS "Users can view and insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view and insert own audit logs"
ON public.audit_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------
-- STORAGE BUCKETS CONFIGURATION (user_files & mad-assets)
-- -------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user_files', 'user_files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('mad-assets', 'mad-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for user_files
DROP POLICY IF EXISTS "Users can manage own files in user_files" ON storage.objects;
CREATE POLICY "Users can manage own files in user_files" ON storage.objects
FOR ALL USING (
  bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Public read for user_files
DROP POLICY IF EXISTS "Public can view user_files" ON storage.objects;
CREATE POLICY "Public can view user_files" ON storage.objects
FOR SELECT USING (bucket_id = 'user_files');

-- Storage RLS Policies for mad-assets
DROP POLICY IF EXISTS "Users can manage own assets in mad-assets" ON storage.objects;
CREATE POLICY "Users can manage own assets in mad-assets" ON storage.objects
FOR ALL USING (
  bucket_id = 'mad-assets' AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'mad-assets' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public can view mad-assets" ON storage.objects;
CREATE POLICY "Public can view mad-assets" ON storage.objects
FOR SELECT USING (bucket_id = 'mad-assets');

-- -------------------------------------------------------------
-- REALTIME SUBSCRIPTIONS
-- Enable realtime events for synchronized cross-device updates
-- -------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.workspaces,
  public.workspace_members,
  public.tables,
  public.table_columns,
  public.table_rows,
  public.cell_values,
  public.user_settings,
  public.profiles,
  public.file_assets;
`;

export const SQL_SETUP_SCHEMA = SUPABASE_SQL_SCHEMA;
