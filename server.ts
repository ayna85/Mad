import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Enable JSON body parsing with large payload limit for spreadsheets and backups
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS & Preflight support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// -------------------------------------------------------------
// PERSISTENT SERVER-SIDE STORAGE ENGINE
// -------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'mad_database.json');

interface ServerSchema {
  users: Array<{
    id: string;
    email: string;
    full_name: string;
    password_hash: string;
    salt: string;
    pin_hash?: string;
    pin_salt?: string;
    created_at: string;
    last_login: string;
  }>;
  profiles: Array<{
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone?: string;
    avatar_url?: string;
    role?: string;
    created_at: string;
    last_login: string;
  }>;
  tables: any[];
  columns: any[];
  rows: any[];
  cells: any[];
  versions: any[];
  backups: any[];
  deleted_items: any[];
  audit_logs: any[];
  settings: any[];
  permanent_tombstones: string[];
}

function initDatabase(): ServerSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData: ServerSchema = {
      users: [],
      profiles: [],
      tables: [],
      columns: [],
      rows: [],
      cells: [],
      versions: [],
      backups: [],
      deleted_items: [],
      audit_logs: [],
      settings: [],
      permanent_tombstones: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || [],
      profiles: parsed.profiles || [],
      tables: parsed.tables || [],
      columns: parsed.columns || [],
      rows: parsed.rows || [],
      cells: parsed.cells || [],
      versions: parsed.versions || [],
      backups: parsed.backups || [],
      deleted_items: parsed.deleted_items || [],
      audit_logs: parsed.audit_logs || [],
      settings: parsed.settings || [],
      permanent_tombstones: parsed.permanent_tombstones || [],
    };
  } catch (err) {
    console.error('Error reading database file, reinitializing:', err);
    return {
      users: [],
      profiles: [],
      tables: [],
      columns: [],
      rows: [],
      cells: [],
      versions: [],
      backups: [],
      deleted_items: [],
      audit_logs: [],
      settings: [],
      permanent_tombstones: [],
    };
  }
}

let dbMemory = initDatabase();

// Restore any orphaned tables from columns/backups so local data is not lost
if (dbMemory.tables.length === 0 && dbMemory.columns.length > 0) {
  const tableIds = new Set(dbMemory.columns.map((c: any) => c.table_id));
  const backupMap = new Map<string, any>();
  (dbMemory.backups || []).forEach((b: any) => {
    if (b.table_id && b.snapshot?.name) backupMap.set(b.table_id, b.snapshot);
  });
  const now = new Date().toISOString();
  for (const tId of tableIds) {
    const snap = backupMap.get(tId);
    const userId = snap?.user_id || dbMemory.columns.find((c: any) => c.table_id === tId)?.user_id || 'system';
    dbMemory.tables.push({
      id: tId,
      user_id: userId,
      name: snap?.name || 'Spreadsheet',
      favorite: Boolean(snap?.favorite),
      created_at: snap?.created_at || now,
      updated_at: snap?.updated_at || now,
    });
  }
}

// -------------------------------------------------------------
// SEED DEFAULT MANAGER ACCOUNT & ASSOCIATE TABLES
// -------------------------------------------------------------
const DEFAULT_MANAGER_ID = 'usr_manager_abdii';
const DEFAULT_MANAGER_EMAIL = 'abdiu3725@gmail.com';

let defaultManager = dbMemory.users.find((u) => u.email === DEFAULT_MANAGER_EMAIL);
if (!defaultManager) {
  const salt = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  defaultManager = {
    id: DEFAULT_MANAGER_ID,
    email: DEFAULT_MANAGER_EMAIL,
    full_name: 'Abdii',
    password_hash: hashPasswordPrimary('Miyawa3A@2026', salt),
    salt,
    created_at: now,
    last_login: now,
  };
  dbMemory.users.push(defaultManager);

  dbMemory.profiles.push({
    id: DEFAULT_MANAGER_ID,
    user_id: DEFAULT_MANAGER_ID,
    full_name: 'Abdii',
    email: DEFAULT_MANAGER_EMAIL,
    role: 'owner',
    created_at: now,
    last_login: now,
  });

  // Assign existing tables and related items to this manager if unassigned or system
  for (const t of dbMemory.tables) {
    if (!t.user_id || t.user_id === 'system') {
      t.user_id = DEFAULT_MANAGER_ID;
    }
  }
  for (const c of dbMemory.columns) {
    if (!c.user_id || c.user_id === 'system') {
      c.user_id = DEFAULT_MANAGER_ID;
    }
  }
  for (const r of dbMemory.rows) {
    if (!r.user_id || r.user_id === 'system') {
      r.user_id = DEFAULT_MANAGER_ID;
    }
  }
  for (const cv of dbMemory.cells) {
    if (!cv.user_id || cv.user_id === 'system') {
      cv.user_id = DEFAULT_MANAGER_ID;
    }
  }
  saveDatabase();
}

// -------------------------------------------------------------
// CENTRAL SUPABASE CONFIGURATION (Shared across all devices)
// -------------------------------------------------------------
const SUPABASE_CONFIG_FILE = path.join(DATA_DIR, 'supabase_config.json');

interface SupabaseConfigData {
  url: string;
  anonKey: string;
}

function loadSupabaseConfig(): SupabaseConfigData {
  let url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  let anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (fs.existsSync(SUPABASE_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SUPABASE_CONFIG_FILE, 'utf8'));
      if (data?.url && (!url || url.includes('your-project'))) {
        url = data.url;
      }
      if (data?.anonKey && (!anonKey || anonKey.includes('your-anon'))) {
        anonKey = data.anonKey;
      }
    } catch (err) {
      console.error('Error reading supabase_config.json:', err);
    }
  }
  return { url, anonKey };
}

let serverSupabaseConfig = loadSupabaseConfig();

function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(dbMemory, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error persisting database:', err);
  }
}

function hashPasswordPrimary(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`salt_${salt}__pw_${password}__mad_miyawa_secure_key_2026`).digest('hex');
}

function hashPasswordSecondary(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`salt_${salt}__pass_${password}__mad_sec_2026`).digest('hex');
}

function hashPasswordWithSalt(password: string, salt: string): string {
  return hashPasswordPrimary(password, salt);
}

function verifyServerPassword(password: string, storedHash: string, salt: string): boolean {
  if (!storedHash) return false;
  const passVariations = [password, password.trim()];
  for (const p of passVariations) {
    if (hashPasswordPrimary(p, salt) === storedHash) return true;
    if (hashPasswordSecondary(p, salt) === storedHash) return true;
    // Direct hash checks for legacy accounts
    const rawSha = crypto.createHash('sha256').update(p).digest('hex');
    if (rawSha === storedHash) return true;
    const vaultSha = crypto.createHash('sha256').update(`mad_vault_${p}_salt_miyawa3a`).digest('hex');
    if (vaultSha === storedHash) return true;
  }
  return false;
}

function hashPinWithSalt(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(`pin_salt_${salt}__pin_${pin}__mad_pin_security_2026`).digest('hex');
}

// -------------------------------------------------------------
// AUTH API ENDPOINTS
// -------------------------------------------------------------

// Sign Up
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = dbMemory.users.find((u) => u.email === cleanEmail);
    if (existing) {
      // If the password provided matches existing account, sign them in directly!
      const isMatch = verifyServerPassword(password, existing.password_hash, existing.salt);
      if (isMatch) {
        existing.last_login = new Date().toISOString();
        // Upgrade password hash to canonical if needed
        existing.password_hash = hashPasswordPrimary(password.trim(), existing.salt);
        let profile = dbMemory.profiles.find((p) => p.user_id === existing.id);
        if (!profile) {
          profile = {
            id: existing.id,
            user_id: existing.id,
            full_name: existing.full_name,
            email: existing.email,
            role: 'owner',
            created_at: existing.created_at,
            last_login: existing.last_login,
          };
          dbMemory.profiles.push(profile);
        } else {
          profile.last_login = existing.last_login;
        }
        saveDatabase();

        return res.json({
          user: {
            id: existing.id,
            email: existing.email,
            user_metadata: { full_name: existing.full_name },
          },
          profile,
          has_pin: Boolean(existing.pin_hash),
          session: {
            access_token: `mad_token_${existing.id}_${Date.now()}`,
            user: { id: existing.id, email: existing.email },
          },
          message: 'Account already existed with matching credentials — signed in successfully!',
        });
      }

      return res.status(400).json({
        error: 'An account with this email address already exists. Please sign in with your password.',
        canSignIn: true,
        email: cleanEmail,
      });
    }

    const userId = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = hashPasswordPrimary(password.trim(), salt);
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      email: cleanEmail,
      full_name: full_name?.trim() || cleanEmail.split('@')[0],
      password_hash,
      salt,
      created_at: now,
      last_login: now,
    };

    const newProfile = {
      id: userId,
      user_id: userId,
      full_name: newUser.full_name,
      email: cleanEmail,
      role: 'owner',
      created_at: now,
      last_login: now,
    };

    dbMemory.users.push(newUser);
    dbMemory.profiles.push(newProfile);
    saveDatabase();

    res.json({
      user: {
        id: userId,
        email: cleanEmail,
        user_metadata: { full_name: newUser.full_name },
      },
      profile: newProfile,
      session: {
        access_token: `mad_token_${userId}_${Date.now()}`,
        user: { id: userId, email: cleanEmail },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Sign up failed.' });
  }
});

// Sign In
app.post('/api/auth/signin', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = dbMemory.users.find((u) => u.email === cleanEmail);
    if (!user) {
      return res.status(404).json({
        error: `No account found for ${cleanEmail}. Please sign up or reset your password.`,
        accountNotFound: true,
        canSignUp: true,
        email: cleanEmail,
      });
    }

    const isMatch = verifyServerPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Incorrect password entered for this account. Click "Reset Password" to set a new password.',
        incorrectPassword: true,
        canReset: true,
        email: cleanEmail,
      });
    }

    // Auto upgrade hash to canonical standard
    user.password_hash = hashPasswordPrimary(password.trim(), user.salt);
    user.last_login = new Date().toISOString();
    let profile = dbMemory.profiles.find((p) => p.user_id === user.id);
    if (!profile) {
      profile = {
        id: user.id,
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
        last_login: user.last_login,
      };
      dbMemory.profiles.push(profile);
    } else {
      profile.last_login = user.last_login;
    }
    saveDatabase();

    res.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.full_name },
      },
      profile,
      has_pin: Boolean(user.pin_hash),
      session: {
        access_token: `mad_token_${user.id}_${Date.now()}`,
        user: { id: user.id, email: user.email },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Sign in failed.' });
  }
});

// Quick Access / Instant Workspace Entry (Manager Abdii)
app.post('/api/auth/quick-access', (req, res) => {
  try {
    let user = dbMemory.users.find((u) => u.email === DEFAULT_MANAGER_EMAIL) || dbMemory.users[0];
    if (!user) {
      const salt = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      user = {
        id: DEFAULT_MANAGER_ID,
        email: DEFAULT_MANAGER_EMAIL,
        full_name: 'Abdii',
        password_hash: hashPasswordPrimary('Miyawa3A@2026', salt),
        salt,
        created_at: now,
        last_login: now,
      };
      dbMemory.users.push(user);
    }

    user.last_login = new Date().toISOString();
    let profile = dbMemory.profiles.find((p) => p.user_id === user.id);
    if (!profile) {
      profile = {
        id: user.id,
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: 'owner',
        created_at: user.created_at,
        last_login: user.last_login,
      };
      dbMemory.profiles.push(profile);
    } else {
      profile.last_login = user.last_login;
    }
    saveDatabase();

    res.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.full_name },
      },
      profile,
      has_pin: Boolean(user.pin_hash),
      session: {
        access_token: `mad_token_${user.id}_${Date.now()}`,
        user: { id: user.id, email: user.email },
      },
      message: 'Logged in as Manager Abdii successfully!',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Quick access failed.' });
  }
});

// Check Account Exists
app.post('/api/auth/check-account', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = dbMemory.users.find((u) => u.email === cleanEmail);
    res.json({
      exists: Boolean(user),
      email: cleanEmail,
      full_name: user?.full_name,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Check account failed.' });
  }
});

// Reset Password / Set New Password
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, newPassword, fullName } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = dbMemory.users.find((u) => u.email === cleanEmail);

    const now = new Date().toISOString();
    if (!user) {
      // Create user if not existing so user can immediately sign in with new password
      const userId = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const password_hash = hashPasswordWithSalt(newPassword, salt);
      user = {
        id: userId,
        email: cleanEmail,
        full_name: fullName || cleanEmail.split('@')[0],
        password_hash,
        salt,
        created_at: now,
        last_login: now,
      };
      dbMemory.users.push(user);
    } else {
      // Update existing user's password
      user.salt = crypto.randomBytes(16).toString('hex');
      user.password_hash = hashPasswordWithSalt(newPassword, user.salt);
      user.last_login = now;
      if (fullName) user.full_name = fullName;
    }

    let profile = dbMemory.profiles.find((p) => p.user_id === user!.id);
    if (!profile) {
      profile = {
        id: user.id,
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
        last_login: user.last_login,
      };
      dbMemory.profiles.push(profile);
    } else {
      profile.last_login = user.last_login;
      if (fullName) profile.full_name = fullName;
    }

    saveDatabase();

    res.json({
      success: true,
      message: 'Password updated successfully! Welcome back.',
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.full_name },
      },
      profile,
      has_pin: Boolean(user.pin_hash),
      session: {
        access_token: `mad_token_${user.id}_${Date.now()}`,
        user: { id: user.id, email: user.email },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Password reset failed.' });
  }
});

// Sync User from Client / IndexedDB
app.post('/api/auth/sync-user', (req, res) => {
  try {
    const { id, email, full_name, password_hash, salt, created_at, last_login } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for syncing user.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = dbMemory.users.find((u) => u.email === cleanEmail || (id && u.id === id));

    const userId = user ? user.id : (id || crypto.randomUUID());
    const now = new Date().toISOString();

    if (!user) {
      user = {
        id: userId,
        email: cleanEmail,
        full_name: full_name || cleanEmail.split('@')[0],
        password_hash: password_hash || '',
        salt: salt || '',
        created_at: created_at || now,
        last_login: last_login || now,
      };
      dbMemory.users.push(user);
    } else {
      if (full_name) user.full_name = full_name;
      if (password_hash) user.password_hash = password_hash;
      if (salt) user.salt = salt;
      user.last_login = now;
    }

    let profile = dbMemory.profiles.find((p) => p.user_id === userId);
    if (!profile) {
      profile = {
        id: userId,
        user_id: userId,
        full_name: user.full_name,
        email: cleanEmail,
        created_at: user.created_at,
        last_login: user.last_login,
      };
      dbMemory.profiles.push(profile);
    }

    saveDatabase();
    res.json({ success: true, user, profile });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to sync user.' });
  }
});

// Get User Profile
app.get('/api/auth/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = dbMemory.profiles.find((p) => p.user_id === userId);
  const user = dbMemory.users.find((u) => u.id === userId);
  if (!profile && !user) {
    return res.status(404).json({ error: 'Profile not found.' });
  }
  res.json({
    profile: profile || {
      id: user!.id,
      user_id: user!.id,
      full_name: user!.full_name,
      email: user!.email,
      created_at: user!.created_at,
      last_login: user!.last_login,
    },
    has_pin: Boolean(user?.pin_hash),
  });
});

// Update User Profile
app.put('/api/auth/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const updates = req.body;

  let profile = dbMemory.profiles.find((p) => p.user_id === userId);
  if (!profile) {
    profile = {
      id: userId,
      user_id: userId,
      full_name: updates.full_name || 'Business User',
      email: updates.email || '',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };
    dbMemory.profiles.push(profile);
  }

  Object.assign(profile, updates);

  const user = dbMemory.users.find((u) => u.id === userId);
  if (user && updates.full_name) {
    user.full_name = updates.full_name;
  }

  saveDatabase();
  res.json({ profile });
});

// Change Password
app.post('/api/auth/change-password', (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = dbMemory.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.salt = crypto.randomBytes(16).toString('hex');
    user.password_hash = hashPasswordWithSalt(newPassword, user.salt);
    saveDatabase();

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Password update failed.' });
  }
});

// PIN Code Management
app.post('/api/auth/pin/set', (req, res) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || !pin || !/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4 to 8 digits (numbers only).' });
    }

    const user = dbMemory.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.pin_salt = crypto.randomBytes(16).toString('hex');
    user.pin_hash = hashPinWithSalt(pin, user.pin_salt);
    saveDatabase();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to set PIN.' });
  }
});

app.post('/api/auth/pin/verify', (req, res) => {
  try {
    const { userId, pin } = req.body;
    const user = dbMemory.users.find((u) => u.id === userId);
    if (!user || !user.pin_hash || !user.pin_salt) {
      return res.status(400).json({ error: 'No PIN configured for this user.' });
    }

    const computed = hashPinWithSalt(pin, user.pin_salt);
    if (computed === user.pin_hash) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ error: 'Incorrect PIN code.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'PIN verification failed.' });
  }
});

app.delete('/api/auth/pin/:userId', (req, res) => {
  const { userId } = req.params;
  const user = dbMemory.users.find((u) => u.id === userId);
  if (user) {
    delete user.pin_hash;
    delete user.pin_salt;
    saveDatabase();
  }
  res.json({ success: true });
});

// Delete Account
app.delete('/api/auth/account/:userId', (req, res) => {
  const { userId } = req.params;
  dbMemory.users = dbMemory.users.filter((u) => u.id !== userId);
  dbMemory.profiles = dbMemory.profiles.filter((p) => p.user_id !== userId);
  dbMemory.tables = dbMemory.tables.filter((t) => t.user_id !== userId);
  dbMemory.columns = dbMemory.columns.filter((c) => c.user_id !== userId);
  dbMemory.rows = dbMemory.rows.filter((r) => r.user_id !== userId);
  dbMemory.cells = dbMemory.cells.filter((c) => c.user_id !== userId);
  dbMemory.versions = dbMemory.versions.filter((v) => v.user_id !== userId);
  dbMemory.backups = dbMemory.backups.filter((b) => b.user_id !== userId);
  dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.user_id !== userId);
  dbMemory.audit_logs = dbMemory.audit_logs.filter((a) => a.user_id !== userId);
  saveDatabase();
  res.json({ success: true });
});

// -------------------------------------------------------------
// FULL REAL-TIME CLOUD DATA SYNC API (MULTI-DEVICE & BROWSER)
// -------------------------------------------------------------

// In-memory Server-Sent Events client registry per user
const sseClients = new Map<string, Set<express.Response>>();

function broadcastSync(userId: string | undefined, data: Record<string, any>) {
  if (!userId) return;
  const clients = sseClients.get(userId);
  if (clients && clients.size > 0) {
    const payload = `data: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  }
}

// Real-time SSE Stream Endpoint
app.get('/api/sync/events/:userId', (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  const userSet = sseClients.get(userId)!;
  userSet.add(res);

  // Initial connect event
  res.write(`data: ${JSON.stringify({ type: 'connected', server_time: new Date().toISOString() })}\n\n`);

  // Heartbeat ping interval to keep connection alive through proxies
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
    userSet.delete(res);
    if (userSet.size === 0) {
      sseClients.delete(userId);
    }
  });
});

// Fetch complete fresh table detail directly from server
app.get('/api/tables/:tableId', (req, res) => {
  const { tableId } = req.params;
  const table = dbMemory.tables.find((t) => t.id === tableId);
  if (!table) {
    return res.status(404).json({ error: 'Table not found' });
  }

  // Filter out any columns, rows, or cells that are in deleted_items or permanent_tombstones
  const deletedColIds = new Set([
    ...dbMemory.permanent_tombstones,
    ...dbMemory.deleted_items.filter((d) => d.item_type === 'column').map((d) => d.item_id || d.id),
  ]);
  const deletedRowIds = new Set([
    ...dbMemory.permanent_tombstones,
    ...dbMemory.deleted_items.filter((d) => d.item_type === 'row').map((d) => d.item_id || d.id),
  ]);

  const columns = dbMemory.columns
    .filter((c) => c.table_id === tableId && !deletedColIds.has(c.id))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const rows = dbMemory.rows
    .filter((r) => r.table_id === tableId && !deletedRowIds.has(r.id))
    .sort((a, b) => (a.row_number || 0) - (b.row_number || 0));
  const cellsList = dbMemory.cells.filter(
    (c) => c.table_id === tableId && !deletedColIds.has(c.column_id) && !deletedRowIds.has(c.row_id)
  );
  const cellsMap: Record<string, any> = {};
  for (const c of cellsList) {
    if (c.row_id && c.column_id) {
      cellsMap[`${c.row_id}_${c.column_id}`] = c.value;
    }
  }
  res.json({
    table,
    columns,
    rows,
    cells: cellsMap,
    server_time: new Date().toISOString(),
  });
});

// Update column properties (styling, color, currency, width, type, formatting)
app.put('/api/columns/:colId', (req, res) => {
  const { colId } = req.params;
  const { userId, ...updates } = req.body || {};
  const idx = dbMemory.columns.findIndex((c) => c.id === colId);
  if (idx >= 0) {
    dbMemory.columns[idx] = {
      ...dbMemory.columns[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveDatabase();
    const effectiveUserId = userId || dbMemory.columns[idx].user_id;
    broadcastSync(effectiveUserId, {
      type: 'column_updated',
      colId,
      tableId: dbMemory.columns[idx].table_id,
    });
    res.json({ success: true, column: dbMemory.columns[idx] });
  } else {
    res.status(404).json({ error: 'Column not found' });
  }
});

// Delete column on server with immediate cell pruning and deletion tracking
app.delete('/api/columns/:colId', (req, res) => {
  const { colId } = req.params;
  const userId = (req.query.user_id as string) || '';
  const tableId = (req.query.table_id as string) || '';
  const deviceId = (req.query.device_id as string) || '';

  const col = dbMemory.columns.find((c) => c.id === colId);
  dbMemory.columns = dbMemory.columns.filter((c) => c.id !== colId);
  dbMemory.cells = dbMemory.cells.filter((c) => c.column_id !== colId);

  if (!dbMemory.permanent_tombstones.includes(colId)) {
    dbMemory.permanent_tombstones.push(colId);
  }

  // Add to deleted_items so all devices/browsers know it's deleted and never resurrect it
  dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.item_id !== colId && d.id !== colId);
  dbMemory.deleted_items.push({
    id: crypto.randomUUID(),
    user_id: userId || col?.user_id || '',
    item_type: 'column',
    item_id: colId,
    table_id: tableId || col?.table_id,
    name: col?.name || 'Deleted Column',
    deleted_at: new Date().toISOString(),
  });

  saveDatabase();
  broadcastSync(userId || col?.user_id, {
    type: 'column_deleted',
    colId,
    tableId: tableId || col?.table_id,
    originDeviceId: deviceId,
  });
  res.json({ success: true, colId });
});

// Delete row on server with immediate cell pruning and deletion tracking
app.delete('/api/rows/:rowId', (req, res) => {
  const { rowId } = req.params;
  const userId = (req.query.user_id as string) || '';
  const tableId = (req.query.table_id as string) || '';
  const deviceId = (req.query.device_id as string) || '';

  const row = dbMemory.rows.find((r) => r.id === rowId);
  dbMemory.rows = dbMemory.rows.filter((r) => r.id !== rowId);
  dbMemory.cells = dbMemory.cells.filter((c) => c.row_id !== rowId);

  if (!dbMemory.permanent_tombstones.includes(rowId)) {
    dbMemory.permanent_tombstones.push(rowId);
  }

  dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.item_id !== rowId && d.id !== rowId);
  dbMemory.deleted_items.push({
    id: crypto.randomUUID(),
    user_id: userId || row?.user_id || '',
    item_type: 'row',
    item_id: rowId,
    table_id: tableId || row?.table_id,
    name: `Row ${row?.row_number || ''}`,
    deleted_at: new Date().toISOString(),
  });

  saveDatabase();
  broadcastSync(userId || row?.user_id, {
    type: 'row_deleted',
    rowId,
    tableId: tableId || row?.table_id,
    originDeviceId: deviceId,
  });
  res.json({ success: true, rowId });
});

// Pull all data for user
app.get('/api/sync/pull/:userId', (req, res) => {
  const { userId } = req.params;
  const userTables = dbMemory.tables.filter((t) => !userId || t.user_id === userId);
  const tableIds = new Set(userTables.map((t) => t.id));

  const userCols = dbMemory.columns.filter((c) => tableIds.has(c.table_id) || c.user_id === userId);
  const userRows = dbMemory.rows.filter((r) => tableIds.has(r.table_id) || r.user_id === userId);
  const userCells = dbMemory.cells.filter((c) => tableIds.has(c.table_id));
  const userVersions = dbMemory.versions.filter((v) => tableIds.has(v.table_id) || v.user_id === userId);
  const userBackups = dbMemory.backups.filter((b) => b.user_id === userId);
  const userDeleted = dbMemory.deleted_items.filter((d) => d.user_id === userId);
  const userAudit = dbMemory.audit_logs.filter((a) => a.user_id === userId);
  const userSettings = dbMemory.settings.filter((s) => s.user_id === userId);

  res.json({
    tables: userTables,
    columns: userCols,
    rows: userRows,
    cells: userCells,
    versions: userVersions,
    backups: userBackups,
    deleted_items: userDeleted,
    audit_logs: userAudit,
    settings: userSettings,
    server_time: new Date().toISOString(),
  });
});

// Push data batch from client
app.post('/api/sync/push', (req, res) => {
  try {
    const {
      userId,
      deviceId,
      tables = [],
      columns = [],
      rows = [],
      cells = [],
      versions = [],
      backups = [],
      deleted_items = [],
      audit_logs = [],
      settings = [],
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required for sync' });
    }

    // Merge deleted items first and immediately purge them from active records
    for (const d of deleted_items) {
      const idx = dbMemory.deleted_items.findIndex((x) => x.id === d.id || (d.item_id && x.item_id === d.item_id));
      if (idx >= 0) {
        dbMemory.deleted_items[idx] = { ...dbMemory.deleted_items[idx], ...d };
      } else {
        dbMemory.deleted_items.push({ ...d, user_id: userId });
      }

      const targetId = d.item_id || d.id;
      if (targetId && !dbMemory.permanent_tombstones.includes(targetId)) {
        dbMemory.permanent_tombstones.push(targetId);
      }

      // If it was a table, purge from active tables, columns, rows, cells
      if (d.item_type === 'table') {
        const tId = targetId;
        dbMemory.tables = dbMemory.tables.filter((t) => t.id !== tId);
        dbMemory.columns = dbMemory.columns.filter((c) => c.table_id !== tId);
        dbMemory.rows = dbMemory.rows.filter((r) => r.table_id !== tId);
        dbMemory.cells = dbMemory.cells.filter((c) => c.table_id !== tId);
      } else if (d.item_type === 'column') {
        const cId = targetId;
        dbMemory.columns = dbMemory.columns.filter((c) => c.id !== cId);
        dbMemory.cells = dbMemory.cells.filter((c) => c.column_id !== cId);
      } else if (d.item_type === 'row') {
        const rId = targetId;
        dbMemory.rows = dbMemory.rows.filter((r) => r.id !== rId);
        dbMemory.cells = dbMemory.cells.filter((c) => c.row_id !== rId);
      }
    }

    // Known deleted IDs to prevent reviving deleted items
    const deletedTableIds = new Set([
      ...dbMemory.permanent_tombstones,
      ...dbMemory.deleted_items.filter((d) => d.item_type === 'table').map((d) => d.item_id || d.id),
    ]);
    const deletedColIds = new Set([
      ...dbMemory.permanent_tombstones,
      ...dbMemory.deleted_items.filter((d) => d.item_type === 'column').map((d) => d.item_id || d.id),
    ]);
    const deletedRowIds = new Set([
      ...dbMemory.permanent_tombstones,
      ...dbMemory.deleted_items.filter((d) => d.item_type === 'row').map((d) => d.item_id || d.id),
    ]);

    // Merge tables (upsert by id with LWW, excluding deleted tables)
    for (const t of tables) {
      if (deletedTableIds.has(t.id)) continue;
      const idx = dbMemory.tables.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const existing = dbMemory.tables[idx];
        const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        const incomingTime = t.updated_at ? new Date(t.updated_at).getTime() : 0;
        if (incomingTime >= existingTime) {
          dbMemory.tables[idx] = { ...existing, ...t, user_id: userId };
        }
      } else {
        dbMemory.tables.push({ ...t, user_id: userId });
      }
    }

    // Merge columns (excluding deleted columns or columns for deleted tables, with LWW)
    for (const c of columns) {
      if (deletedColIds.has(c.id) || (c.table_id && deletedTableIds.has(c.table_id))) continue;
      const idx = dbMemory.columns.findIndex((x) => x.id === c.id);
      if (idx >= 0) {
        const existing = dbMemory.columns[idx];
        const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        const incomingTime = c.updated_at ? new Date(c.updated_at).getTime() : 0;
        if (incomingTime >= existingTime) {
          dbMemory.columns[idx] = { ...existing, ...c, user_id: userId };
        }
      } else {
        dbMemory.columns.push({ ...c, user_id: userId });
      }
    }

    // Merge rows (excluding deleted rows or rows for deleted tables, with LWW)
    for (const r of rows) {
      if (deletedRowIds.has(r.id) || (r.table_id && deletedTableIds.has(r.table_id))) continue;
      const idx = dbMemory.rows.findIndex((x) => x.id === r.id);
      if (idx >= 0) {
        const existing = dbMemory.rows[idx];
        const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        const incomingTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;
        if (incomingTime >= existingTime) {
          dbMemory.rows[idx] = { ...existing, ...r, user_id: userId };
        }
      } else {
        dbMemory.rows.push({ ...r, user_id: userId });
      }
    }

    // Merge cells (excluding cells for deleted tables, columns, or rows, with LWW)
    for (const cell of cells) {
      if (cell.table_id && deletedTableIds.has(cell.table_id)) continue;
      if (cell.column_id && deletedColIds.has(cell.column_id)) continue;
      if (cell.row_id && deletedRowIds.has(cell.row_id)) continue;
      const idx = dbMemory.cells.findIndex(
        (x) => (x.id && x.id === cell.id) || (x.row_id === cell.row_id && x.column_id === cell.column_id)
      );
      if (idx >= 0) {
        const existing = dbMemory.cells[idx];
        const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        const incomingTime = cell.updated_at ? new Date(cell.updated_at).getTime() : 0;
        if (incomingTime >= existingTime) {
          dbMemory.cells[idx] = { ...existing, ...cell };
        }
      } else {
        dbMemory.cells.push({ ...cell, id: cell.id || crypto.randomUUID() });
      }
    }

    // Merge versions
    for (const v of versions) {
      const idx = dbMemory.versions.findIndex((x) => x.id === v.id);
      if (idx >= 0) {
        dbMemory.versions[idx] = { ...dbMemory.versions[idx], ...v };
      } else {
        dbMemory.versions.push({ ...v, user_id: userId });
      }
    }

    // Merge backups
    for (const b of backups) {
      const idx = dbMemory.backups.findIndex((x) => x.id === b.id);
      if (idx >= 0) {
        dbMemory.backups[idx] = { ...dbMemory.backups[idx], ...b };
      } else {
        dbMemory.backups.push({ ...b, user_id: userId });
      }
    }

    // Merge audit logs
    for (const a of audit_logs) {
      const idx = dbMemory.audit_logs.findIndex((x) => x.id === a.id);
      if (idx >= 0) {
        dbMemory.audit_logs[idx] = { ...dbMemory.audit_logs[idx], ...a };
      } else {
        dbMemory.audit_logs.push({ ...a, user_id: userId });
      }
    }

    // Merge settings
    for (const s of settings) {
      const idx = dbMemory.settings.findIndex((x) => x.user_id === userId);
      if (idx >= 0) {
        dbMemory.settings[idx] = { ...dbMemory.settings[idx], ...s };
      } else {
        dbMemory.settings.push({ ...s, user_id: userId });
      }
    }

    saveDatabase();
    broadcastSync(userId, {
      type: 'data_pushed',
      tablesCount: tables.length,
      columnsCount: columns.length,
      rowsCount: rows.length,
      cellsCount: cells.length,
      originDeviceId: deviceId,
    });
    res.json({ success: true, updated_at: new Date().toISOString() });
  } catch (err: any) {
    console.error('Push sync error:', err);
    res.status(500).json({ error: err?.message || 'Push sync failed' });
  }
});

// Delete table on server
app.delete('/api/tables/:tableId', (req, res) => {
  const { tableId } = req.params;
  const userId = (req.query.user_id as string) || '';
  const deviceId = (req.query.device_id as string) || '';
  const tbl = dbMemory.tables.find((t) => t.id === tableId);

  dbMemory.tables = dbMemory.tables.filter((t) => t.id !== tableId);
  dbMemory.columns = dbMemory.columns.filter((c) => c.table_id !== tableId);
  dbMemory.rows = dbMemory.rows.filter((r) => r.table_id !== tableId);
  dbMemory.cells = dbMemory.cells.filter((c) => c.table_id !== tableId);
  dbMemory.versions = dbMemory.versions.filter((v) => v.table_id !== tableId);

  if (!dbMemory.permanent_tombstones.includes(tableId)) {
    dbMemory.permanent_tombstones.push(tableId);
  }

  // Record in deleted_items so all devices know it's deleted and never revive it
  dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.item_id !== tableId && d.id !== tableId);
  dbMemory.deleted_items.push({
    id: crypto.randomUUID(),
    user_id: userId || tbl?.user_id || '',
    item_type: 'table',
    item_id: tableId,
    name: tbl?.name || 'Deleted Table',
    deleted_at: new Date().toISOString(),
  });

  saveDatabase();
  broadcastSync(userId || tbl?.user_id, {
    type: 'table_deleted',
    tableId,
    originDeviceId: deviceId,
  });
  res.json({ success: true });
});

// Delete specific item from trash on server (by trash id or item_id)
app.delete('/api/trash/:id', (req, res) => {
  const { id } = req.params;
  if (!dbMemory.permanent_tombstones.includes(id)) {
    dbMemory.permanent_tombstones.push(id);
  }
  const item = dbMemory.deleted_items.find((d) => d.id === id || d.item_id === id);
  if (item?.item_id && !dbMemory.permanent_tombstones.includes(item.item_id)) {
    dbMemory.permanent_tombstones.push(item.item_id);
  }
  dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.id !== id && d.item_id !== id);
  saveDatabase();
  res.json({ success: true });
});

// Delete all trash items for a table
app.delete('/api/trash/table/:tableId', (req, res) => {
  const { tableId } = req.params;
  if (!dbMemory.permanent_tombstones.includes(tableId)) {
    dbMemory.permanent_tombstones.push(tableId);
  }
  dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.item_id !== tableId && d.id !== tableId);
  saveDatabase();
  res.json({ success: true });
});

// Empty all trash for a user
app.delete('/api/trash/all/:userId', (req, res) => {
  const { userId } = req.params;
  const userDeleted = dbMemory.deleted_items.filter((d) => d.user_id === userId);
  for (const d of userDeleted) {
    const tId = d.item_id || d.id;
    if (tId && !dbMemory.permanent_tombstones.includes(tId)) {
      dbMemory.permanent_tombstones.push(tId);
    }
  }
  dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.user_id !== userId);
  saveDatabase();
  broadcastSync(userId, { type: 'trash_emptied' });
  res.json({ success: true });
});

// Delete folder and its tables on server
app.delete('/api/folders/:folderName', (req, res) => {
  const { folderName } = req.params;
  const userId = req.query.user_id as string;
  const decodedFolder = decodeURIComponent(folderName).toLowerCase().trim();
  
  const toDelete = dbMemory.tables.filter(
    (t) => (!userId || t.user_id === userId) && (t.folder_name || '').toLowerCase().trim() === decodedFolder
  );
  const toDeleteIds = new Set(toDelete.map((t) => t.id));
  for (const id of toDeleteIds) {
    if (!dbMemory.permanent_tombstones.includes(id)) {
      dbMemory.permanent_tombstones.push(id);
    }
  }
  
  dbMemory.tables = dbMemory.tables.filter((t) => !toDeleteIds.has(t.id));
  dbMemory.columns = dbMemory.columns.filter((c) => !toDeleteIds.has(c.table_id));
  dbMemory.rows = dbMemory.rows.filter((r) => !toDeleteIds.has(r.table_id));
  dbMemory.cells = dbMemory.cells.filter((c) => !toDeleteIds.has(c.table_id));
  dbMemory.versions = dbMemory.versions.filter((v) => !toDeleteIds.has(v.table_id));

  // Add all deleted tables into deleted_items so devices don't revive them
  for (const tbl of toDelete) {
    dbMemory.deleted_items = dbMemory.deleted_items.filter((d) => d.item_id !== tbl.id && d.id !== tbl.id);
    dbMemory.deleted_items.push({
      id: crypto.randomUUID(),
      user_id: userId || tbl.user_id,
      item_type: 'table',
      item_id: tbl.id,
      name: tbl.name,
      deleted_at: new Date().toISOString(),
    });
  }
  
  saveDatabase();
  broadcastSync(userId, { type: 'folder_deleted', folderName: decodedFolder, deletedCount: toDelete.length });
  res.json({ success: true, count: toDelete.length });
});

// Ungroup folder on server (removes folder tag without deleting tables)
app.post('/api/folders/:folderName/ungroup', (req, res) => {
  const { folderName } = req.params;
  const { userId } = req.body || {};
  const decodedFolder = decodeURIComponent(folderName).toLowerCase().trim();
  
  let count = 0;
  dbMemory.tables = dbMemory.tables.map((t) => {
    if ((!userId || t.user_id === userId) && (t.folder_name || '').toLowerCase().trim() === decodedFolder) {
      count++;
      return { ...t, folder_name: undefined, updated_at: new Date().toISOString() };
    }
    return t;
  });
  
  saveDatabase();
  broadcastSync(userId, { type: 'folder_ungrouped', folderName: decodedFolder });
  res.json({ success: true, count });
});

// Rename folder across tables on server
app.post('/api/folders/:folderName/rename', (req, res) => {
  const { folderName } = req.params;
  const { newFolderName, userId } = req.body || {};
  const decodedFolder = decodeURIComponent(folderName).toLowerCase().trim();
  const cleanNew = (newFolderName || '').trim();
  
  let count = 0;
  dbMemory.tables = dbMemory.tables.map((t) => {
    if ((!userId || t.user_id === userId) && (t.folder_name || '').toLowerCase().trim() === decodedFolder) {
      count++;
      return { ...t, folder_name: cleanNew || undefined, updated_at: new Date().toISOString() };
    }
    return t;
  });
  
  saveDatabase();
  broadcastSync(userId, { type: 'folder_renamed', oldName: decodedFolder, newName: cleanNew });
  res.json({ success: true, count });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    users_count: dbMemory.users.length,
    tables_count: dbMemory.tables.length,
    timestamp: new Date().toISOString(),
  });
});

// Central Supabase Config Endpoints
app.get('/api/supabase-config', (req, res) => {
  const cfg = loadSupabaseConfig();
  res.json({
    url: cfg.url || '',
    anonKey: cfg.anonKey || '',
    isConfigured: Boolean(cfg.url && cfg.anonKey && !cfg.url.includes('your-project')),
  });
});

app.post('/api/supabase-config', (req, res) => {
  try {
    const { url, anonKey } = req.body;
    if (!url || !anonKey) {
      return res.status(400).json({ error: 'url and anonKey are required.' });
    }
    const cleanUrl = String(url).trim();
    const cleanKey = String(anonKey).trim();
    serverSupabaseConfig = { url: cleanUrl, anonKey: cleanKey };
    process.env.VITE_SUPABASE_URL = cleanUrl;
    process.env.SUPABASE_URL = cleanUrl;
    process.env.VITE_SUPABASE_ANON_KEY = cleanKey;
    process.env.SUPABASE_ANON_KEY = cleanKey;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SUPABASE_CONFIG_FILE, JSON.stringify(serverSupabaseConfig, null, 2), 'utf8');
    res.json({ success: true, url: cleanUrl, isConfigured: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save config.' });
  }
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & STATIC ASSETS
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Inject active Supabase config into HTML during development
    app.use(async (req, res, next) => {
      if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
        try {
          const indexPath = path.join(process.cwd(), 'index.html');
          let template = fs.readFileSync(indexPath, 'utf8');
          const cfg = loadSupabaseConfig();
          const injection = `<script>window.__SUPABASE_CONFIG__ = ${JSON.stringify(cfg)};</script>`;
          template = template.replace('</head>', `  ${injection}\n  </head>`);
          const html = await vite.transformIndexHtml(req.url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
          return;
        } catch (e) {
          next(e);
          return;
        }
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        const cfg = loadSupabaseConfig();
        const injection = `<script>window.__SUPABASE_CONFIG__ = ${JSON.stringify(cfg)};</script>`;
        html = html.replace('</head>', `  ${injection}\n  </head>`);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
      } else {
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAD Miyawa 3A Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
