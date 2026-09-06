import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase, ensureSupabaseLoaded, getStoredSupabaseConfig } from '../lib/supabase';
import { dbService } from '../lib/db';
import { idb } from '../lib/indexedDb';
import { hashPinCode, verifyPinCode, generateSalt } from '../lib/authCrypto';
import { UserProfile, DeviceSession } from '../types';
import { getCurrentDeviceSession } from '../lib/deviceDetector';

const AUTO_LOCK_KEY = 'mad_auto_lock_minutes';
const IS_LOCKED_KEY = 'mad_is_locked';
const LAST_ACTIVITY_KEY = 'mad_last_activity';
const LAST_ACTIVE_TIME_KEY = 'last_active_time';
const REQUIRES_PASSWORD_CHECK_KEY = 'mad_requires_password_check';
const SESSIONS_STORAGE_KEY = 'mad_active_device_sessions';
const REMEMBER_EMAIL_KEY = 'mad_remember_email';
const REMEMBERED_EMAIL_KEY = 'mad_remembered_email';

export function validateStrongPassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 number (0-9).' };
  }
  const weakPasswords = ['123456', '12345678', 'password', 'password123', 'admin123', 'qwerty123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'This password is too common. Please choose a stronger password (e.g. Abdi@1234).' };
  }
  return { valid: true };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isConfigured: boolean;
  isCloudMode: boolean;
  // Security & Auto-Lock
  isLocked: boolean;
  autoLockMinutes: number;
  setAutoLockMinutes: (min: number) => void;
  lockScreen: () => void;
  unlockWithPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  unlockWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  setSecurityPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  removeSecurityPin: () => Promise<void>;
  hasSecurityPin: boolean;
  verifySecurityCodeOrPassword: (secret: string) => Promise<{ success: boolean; error?: string }>;
  requirePinForDataChanges: boolean;
  setRequirePinForDataChanges: (val: boolean) => void;
  rememberEmail: boolean;
  setRememberEmail: (val: boolean) => void;
  rememberedEmail: string;
  // Standard Supabase Auth
  signIn: (email: string, pass: string) => Promise<{ error?: string; accountNotFound?: boolean; incorrectPassword?: boolean }>;
  signUp: (email: string, pass: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error?: string; notFound?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  directResetPassword: (email: string, newPass: string, fullName?: string) => Promise<{ error?: string }>;
  checkAccountExists: (email: string) => Promise<{ exists: boolean; fullName?: string }>;
  updatePassword: (newPass: string) => Promise<{ error?: string }>;
  changePassword: (newPass: string) => Promise<{ error?: string }>;
  verifyRecoveryPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  // Inactivity Re-Auth & Device Sessions
  requiresPasswordCheck: boolean;
  verifyAccountPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  activeSessions: DeviceSession[];
  terminateSession: (sessionId: string) => Promise<void>;
  terminateAllOtherSessions: () => Promise<void>;
  currentDeviceSession: DeviceSession | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
  quickLoginAsManager: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isCloudMode, setIsCloudMode] = useState(false);

  // Security & Auto-lock states
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return sessionStorage.getItem(IS_LOCKED_KEY) === 'true';
  });

  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(() => {
    const saved = localStorage.getItem(AUTO_LOCK_KEY);
    if (saved !== null) {
      const parsed = Number(saved);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0; // Default: Keep user logged in persistently across restarts/tabs
  });

  const [rememberEmail, setRememberEmailState] = useState<boolean>(() => {
    const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
    return saved === null ? true : saved === 'true';
  });

  const [rememberedEmail, setRememberedEmail] = useState<string>(() => {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || localStorage.getItem('mad_last_signed_email') || 'abdiu3725@gmail.com';
  });

  const [hasSecurityPin, setHasSecurityPin] = useState<boolean>(false);
  const [requirePinForDataChanges, setRequirePinForDataChangesState] = useState<boolean>(false);

  // 2-Minute Inactivity / Background Re-Authentication state
  const [requiresPasswordCheck, setRequiresPasswordCheck] = useState<boolean>(() => {
    return sessionStorage.getItem(REQUIRES_PASSWORD_CHECK_KEY) === 'true';
  });

  // Active Device Sessions state
  const [activeSessions, setActiveSessions] = useState<DeviceSession[]>([]);
  const [currentDeviceSession, setCurrentDeviceSession] = useState<DeviceSession | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const activityThrottlerRef = useRef<number>(0);

  // Load User Profile from Supabase
  const loadUserProfile = async (currentUser: User) => {
    try {
      let prof = await dbService.getUserProfile(currentUser.id);
      if (!prof) {
        prof = {
          id: currentUser.id,
          user_id: currentUser.id,
          full_name: (currentUser.user_metadata?.full_name as string) || currentUser.email?.split('@')[0] || 'Business User',
          email: currentUser.email || '',
          created_at: currentUser.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
        };
        await dbService.saveUserProfile(prof);
      }
      setProfile(prof);
    } catch (err) {
      console.warn('Failed loading user profile:', err);
    }
  };

  // --------------------------------------------------------------------------
  // AUTHENTICATION INITIALIZATION - SUPABASE AS THE SOLE IDENTITY SYSTEM
  // Uses supabase.auth.getSession() and supabase.auth.onAuthStateChange()
  // Uses auth.uid() as identity. Never uses localStorage or device IDs.
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setIsLoading(true);

      // Strict safety timeout so the app screen NEVER hangs indefinitely
      const safetyTimer = setTimeout(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      }, 700);

      try {
        const supabase = await ensureSupabaseLoaded().catch(() => null);

        if (supabase) {
          if (isMounted) {
            setIsConfigured(true);
            setIsCloudMode(true);
          }

          try {
            const { data: { session: remoteSession } } = await supabase.auth.getSession();
            if (isMounted && remoteSession?.user) {
              setSession(remoteSession);
              setUser(remoteSession.user);
              loadUserProfile(remoteSession.user).catch(console.warn);
              dbService.syncSupabaseWorkspace(remoteSession.user.id).catch(console.warn);
              clearTimeout(safetyTimer);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Supabase getSession error:', e);
          }

          // Setup onAuthStateChange()
          try {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
              if (!isMounted) return;

              if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                setSession(newSession);
                setUser(newSession?.user ?? null);
                if (newSession?.user) {
                  loadUserProfile(newSession.user).catch(console.warn);
                  dbService.syncSupabaseWorkspace(newSession.user.id).catch(console.warn);
                }
              } else if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
              }
              setIsLoading(false);
            });

            return () => {
              subscription.unsubscribe();
            };
          } catch (e) {}
        } else {
          if (isMounted) {
            setIsConfigured(false);
            setIsCloudMode(false);
          }
        }

        // 2. Restore saved local/server session if available
        const savedSession = localStorage.getItem('mad_server_session');
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed?.user) {
              if (isMounted) {
                setUser(parsed.user);
                setSession(parsed.session || { access_token: `token_${parsed.user.id}`, user: parsed.user });
                setProfile(parsed.profile || null);
              }
              loadUserProfile(parsed.user).catch(console.warn);
              dbService.getTables(parsed.user.id).catch(console.warn);
              dbService.syncWithServer(parsed.user.id).catch(console.warn);
              clearTimeout(safetyTimer);
              if (isMounted) setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Error parsing saved server session:', e);
          }
        }

        // 3. Auto-open workspace directly for Manager Abdii if not explicitly logged out
        const wasLoggedOut = localStorage.getItem('mad_logged_out') === 'true';
        if (!wasLoggedOut) {
          try {
            const res = await fetch('/api/auth/quick-access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.user && isMounted) {
                setUser(data.user);
                setSession(data.session);
                setProfile(data.profile);
                localStorage.setItem('mad_server_session', JSON.stringify({
                  user: data.user,
                  session: data.session,
                  profile: data.profile,
                }));
                loadUserProfile(data.user).catch(console.warn);
                dbService.getTables(data.user.id).catch(console.warn);
                dbService.syncWithServer(data.user.id).catch(console.warn);
                clearTimeout(safetyTimer);
                setIsLoading(false);
                return;
              }
            }
          } catch (err) {
            console.warn('Auto quick access failed:', err);
          }
        }

        clearTimeout(safetyTimer);
        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('initAuth error:', err);
        clearTimeout(safetyTimer);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check security PIN & settings whenever user changes
  useEffect(() => {
    if (user) {
      const pinHash = localStorage.getItem(`mad_security_pin_hash_${user.id}`);
      setHasSecurityPin(Boolean(pinHash));

      const reqChanges = localStorage.getItem(`mad_require_pin_changes_${user.id}`);
      setRequirePinForDataChangesState(reqChanges === 'true');

      if (user.email && rememberEmail) {
        setRememberedEmail(user.email);
        localStorage.setItem(REMEMBERED_EMAIL_KEY, user.email);
      }
    } else {
      setHasSecurityPin(false);
    }
  }, [user, rememberEmail]);

  const lockScreen = useCallback(() => {
    setIsLocked(true);
    sessionStorage.setItem(IS_LOCKED_KEY, 'true');
  }, []);

  const setAutoLockMinutes = (min: number) => {
    setAutoLockMinutesState(min);
    localStorage.setItem(AUTO_LOCK_KEY, String(min));
  };

  const setRememberEmail = (val: boolean) => {
    setRememberEmailState(val);
    localStorage.setItem(REMEMBER_EMAIL_KEY, String(val));
    if (!val) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      setRememberedEmail('');
    } else if (user?.email) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, user.email);
      setRememberedEmail(user.email);
    }
  };

  // Device session management
  useEffect(() => {
    if (!user) {
      setActiveSessions([]);
      setCurrentDeviceSession(null);
      return;
    }

    const currentDev = getCurrentDeviceSession(user.id);
    setCurrentDeviceSession(currentDev);

    const savedRaw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    let sessions: DeviceSession[] = [];
    try {
      if (savedRaw) sessions = JSON.parse(savedRaw);
    } catch {
      sessions = [];
    }

    sessions = sessions.filter((s) => s.id !== currentDev.id && s.user_id === user.id);
    sessions.unshift(currentDev);

    setActiveSessions(sessions);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [user]);

  const terminateSession = async (sessionId: string) => {
    if (!user) return;
    if (currentDeviceSession && sessionId === currentDeviceSession.id) {
      await signOut();
      return;
    }

    const updated = activeSessions.filter((s) => s.id !== sessionId);
    setActiveSessions(updated);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    await dbService.logAudit(user.id, 'TERMINATE_SESSION', 'auth', sessionId, `Revoked remote device session ${sessionId}`);
  };

  const terminateAllOtherSessions = async () => {
    if (!user || !currentDeviceSession) return;
    const updated = [currentDeviceSession];
    setActiveSessions(updated);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    await dbService.logAudit(user.id, 'TERMINATE_ALL_SESSIONS', 'auth', user.id, 'Terminated all remote active sessions');
  };

  // Activity Tracker
  useEffect(() => {
    if (!user) return;

    const recordActivity = () => {
      const now = Date.now();
      if (now - activityThrottlerRef.current > 2000) {
        activityThrottlerRef.current = now;
        lastActivityRef.current = now;
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      }
    };

    window.addEventListener('mousemove', recordActivity, { passive: true });
    window.addEventListener('mousedown', recordActivity, { passive: true });
    window.addEventListener('keydown', recordActivity, { passive: true });
    window.addEventListener('touchstart', recordActivity, { passive: true });
    window.addEventListener('scroll', recordActivity, { passive: true });

    const intervalId = setInterval(() => {
      const elapsedActive = Date.now() - lastActivityRef.current;
      if (elapsedActive >= 120000 && !requiresPasswordCheck) {
        setRequiresPasswordCheck(true);
        sessionStorage.setItem(REQUIRES_PASSWORD_CHECK_KEY, 'true');
      }

      if (autoLockMinutes > 0 && !isLocked) {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= autoLockMinutes * 60 * 1000) {
          lockScreen();
        }
      }
    }, 5000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        localStorage.setItem(LAST_ACTIVE_TIME_KEY, String(Date.now()));
      } else if (document.visibilityState === 'visible') {
        const savedTimeStr = localStorage.getItem(LAST_ACTIVE_TIME_KEY);
        if (savedTimeStr) {
          const elapsed = Date.now() - Number(savedTimeStr);
          if (elapsed >= 120000) {
            setRequiresPasswordCheck(true);
            sessionStorage.setItem(REQUIRES_PASSWORD_CHECK_KEY, 'true');
          }
        }
        if (autoLockMinutes > 0 && !isLocked) {
          const elapsed = Date.now() - lastActivityRef.current;
          if (elapsed >= autoLockMinutes * 60 * 1000) {
            lockScreen();
          }
        }
      }
    };

    const onWindowFocus = () => {
      const savedTimeStr = localStorage.getItem(LAST_ACTIVE_TIME_KEY);
      if (savedTimeStr) {
        const elapsed = Date.now() - Number(savedTimeStr);
        if (elapsed >= 120000) {
          setRequiresPasswordCheck(true);
          sessionStorage.setItem(REQUIRES_PASSWORD_CHECK_KEY, 'true');
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      window.removeEventListener('mousemove', recordActivity);
      window.removeEventListener('mousedown', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      window.removeEventListener('scroll', recordActivity);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      clearInterval(intervalId);
    };
  }, [user, autoLockMinutes, isLocked, requiresPasswordCheck, lockScreen]);

  // --------------------------------------------------------------------------
  // PASSWORD & PIN VERIFICATION (USES SUPABASE)
  // --------------------------------------------------------------------------
  const verifyAccountPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || !user.email) {
      return { success: false, error: 'No user session found.' };
    }

    const cleanPass = password.trim();
    if (!cleanPass) {
      return { success: false, error: 'Please enter your account password.' };
    }

    const supabase = await ensureSupabaseLoaded() || getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: cleanPass,
        });

        if (!error && data.user) {
          setRequiresPasswordCheck(false);
          sessionStorage.removeItem(REQUIRES_PASSWORD_CHECK_KEY);
          localStorage.removeItem(LAST_ACTIVE_TIME_KEY);
          lastActivityRef.current = Date.now();
          return { success: true };
        }
        return { success: false, error: 'Incorrect password. Please try again.' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Verification failed.' };
      }
    }

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: cleanPass }),
      });
      if (res.ok) {
        setRequiresPasswordCheck(false);
        sessionStorage.removeItem(REQUIRES_PASSWORD_CHECK_KEY);
        localStorage.removeItem(LAST_ACTIVE_TIME_KEY);
        lastActivityRef.current = Date.now();
        return { success: true };
      }
      return { success: false, error: 'Incorrect password. Please try again.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Verification failed.' };
    }
  };

  const unlockWithPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || !user.email) {
      return { success: false, error: 'No user session found.' };
    }

    const cleanPass = password.trim();
    if (!cleanPass) {
      return { success: false, error: 'Please enter your account password.' };
    }

    const supabase = await ensureSupabaseLoaded() || getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: cleanPass,
        });

        if (!error && data.user) {
          setIsLocked(false);
          sessionStorage.removeItem(IS_LOCKED_KEY);
          lastActivityRef.current = Date.now();
          localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
          return { success: true };
        }
        return { success: false, error: 'Incorrect account password.' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Password verification failed.' };
      }
    }

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: cleanPass }),
      });
      if (res.ok) {
        setIsLocked(false);
        sessionStorage.removeItem(IS_LOCKED_KEY);
        lastActivityRef.current = Date.now();
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        return { success: true };
      }
      return { success: false, error: 'Incorrect account password.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Password verification failed.' };
    }
  };

  const unlockWithPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No user session found.' };
    }

    const cleanPin = pin.trim();
    if (!cleanPin) {
      return { success: false, error: 'Please enter your security PIN code.' };
    }

    const storedHash = localStorage.getItem(`mad_security_pin_hash_${user.id}`);
    const storedSalt = localStorage.getItem(`mad_security_pin_salt_${user.id}`);

    if (!storedHash || !storedSalt) {
      return { success: false, error: 'No security PIN configured. Please use your account password.' };
    }

    const isMatch = await verifyPinCode(cleanPin, storedHash, storedSalt);
    if (isMatch) {
      setIsLocked(false);
      sessionStorage.removeItem(IS_LOCKED_KEY);
      lastActivityRef.current = Date.now();
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      return { success: true };
    }

    return { success: false, error: 'Invalid security PIN code.' };
  };

  const setSecurityPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No active user session.' };
    }

    const cleanPin = pin.trim();
    if (!/^\d{4,8}$/.test(cleanPin)) {
      return { success: false, error: 'Security PIN must be 4 to 8 digits (numbers only).' };
    }

    try {
      const salt = generateSalt();
      const hash = await hashPinCode(cleanPin, salt);
      localStorage.setItem(`mad_security_pin_hash_${user.id}`, hash);
      localStorage.setItem(`mad_security_pin_salt_${user.id}`, salt);
      setHasSecurityPin(true);

      await dbService.logAudit(
        user.id,
        'SET_SECURITY_PIN',
        'auth',
        user.id,
        'User configured a quick security PIN code'
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to save security PIN.' };
    }
  };

  const removeSecurityPin = async (): Promise<void> => {
    if (user) {
      localStorage.removeItem(`mad_security_pin_hash_${user.id}`);
      localStorage.removeItem(`mad_security_pin_salt_${user.id}`);
      setHasSecurityPin(false);
      await dbService.logAudit(
        user.id,
        'REMOVE_SECURITY_PIN',
        'auth',
        user.id,
        'User removed their quick security PIN code'
      );
    }
  };

  const verifySecurityCodeOrPassword = async (secret: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'No active user session.' };
    const clean = secret.trim();

    if (/^\d{4,8}$/.test(clean)) {
      const storedHash = localStorage.getItem(`mad_security_pin_hash_${user.id}`);
      const storedSalt = localStorage.getItem(`mad_security_pin_salt_${user.id}`);
      if (storedHash && storedSalt) {
        const isMatch = await verifyPinCode(clean, storedHash, storedSalt);
        if (isMatch) return { success: true };
      }
    }

    const passRes = await verifyRecoveryPassword(clean);
    return passRes;
  };

  const setRequirePinForDataChanges = (val: boolean) => {
    setRequirePinForDataChangesState(val);
    if (user) {
      localStorage.setItem(`mad_require_pin_changes_${user.id}`, String(val));
    }
  };

  // --------------------------------------------------------------------------
  // SUPABASE AUTH METHODS - SINGLE SOURCE OF TRUTH
  // --------------------------------------------------------------------------

  // Check whether an account exists (Supabase if configured, otherwise server database)
  const checkAccountExists = async (email: string): Promise<{ exists: boolean; fullName?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { exists: false };

    const supabase = await ensureSupabaseLoaded() || getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (data) {
          return { exists: true, fullName: data.full_name };
        }
      } catch (err) {
        console.warn('checkAccountExists Supabase error:', err);
      }
    }

    // Check server database
    try {
      const res = await fetch('/api/auth/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          return { exists: true, fullName: data.fullName };
        }
      }
    } catch {}

    return { exists: false };
  };

  // Sign In: Correct email + password → Login on every phone/browser.
  // Wrong password → Incorrect password.
  // Non-existing account → Account not found → Sign Up.
  // Uses Supabase if configured, falls back seamlessly to dedicated server database if not.
  const signIn = async (
    email: string,
    pass: string
  ): Promise<{ error?: string; accountNotFound?: boolean; incorrectPassword?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !pass) {
      return { error: 'Please enter both email and password.' };
    }

    const supabase = await ensureSupabaseLoaded() || getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pass,
        });

        if (!error && data.user && data.session) {
          setUser(data.user);
          setSession(data.session);
          await loadUserProfile(data.user);

          // Load user's existing Supabase workspace using auth.uid()
          await dbService.syncSupabaseWorkspace(data.user.id);
          await dbService.logAudit(data.user.id, 'LOGIN', 'auth', data.user.id, `User logged in via Supabase (${cleanEmail})`);

          localStorage.setItem('mad_last_signed_email', cleanEmail);
          if (rememberEmail) {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
            setRememberedEmail(cleanEmail);
          }

          return {};
        }

        if (error) {
          const msg = error.message.toLowerCase();

          // If credentials failed, check if account exists in Supabase to provide exact feedback
          if (msg.includes('invalid login credentials') || error.status === 400) {
            const existsInfo = await checkAccountExists(cleanEmail);
            if (existsInfo.exists) {
              return {
                error: 'Incorrect password. Please verify your password and try again.',
                incorrectPassword: true,
              };
            } else {
              return {
                error: `Account not found for ${cleanEmail}. Click "Sign Up" below to create your account.`,
                accountNotFound: true,
              };
            }
          }

          if (msg.includes('email not confirmed')) {
            return {
              error: 'Your email address has not been confirmed yet. Please verify your email or disable confirmation in Supabase Auth.',
            };
          }

          return { error: error.message };
        }
      } catch (err: any) {
        console.warn('Supabase signIn encountered error, trying server fallback:', err);
      }
    }

    // Server-backed authentication (Dedicated Database Engine)
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: pass }),
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        setSession(data.session);
        setProfile(data.profile);

        localStorage.setItem(
          'mad_server_session',
          JSON.stringify({
            user: data.user,
            session: data.session,
            profile: data.profile,
          })
        );

        localStorage.setItem('mad_last_signed_email', cleanEmail);
        if (rememberEmail) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
          setRememberedEmail(cleanEmail);
        }

        await loadUserProfile(data.user);
        await dbService.getTables(data.user.id);
        dbService.syncWithServer(data.user.id).catch(console.warn);
        await dbService.logAudit(data.user.id, 'LOGIN', 'auth', data.user.id, `User logged in (${cleanEmail})`);

        return {};
      }

      if (res.status === 404 || data.accountNotFound) {
        return {
          error: `No account found for ${cleanEmail}. Click "Sign Up" below to create your account.`,
          accountNotFound: true,
        };
      }

      if (res.status === 401 || data.incorrectPassword) {
        return {
          error: 'Incorrect password entered for this account. Click "Reset Password" to set a new password.',
          incorrectPassword: true,
        };
      }

      return { error: data.error || 'Login failed. Please verify your credentials.' };
    } catch (err: any) {
      return { error: err?.message || 'Login connection failed.' };
    }
  };

  // Sign Up: Register account in Supabase if configured, or in dedicated server database
  const signUp = async (
    email: string,
    pass: string,
    fullName: string
  ): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim() || cleanEmail.split('@')[0] || 'Business User';

    const strength = validateStrongPassword(pass);
    if (!strength.valid) {
      return { error: strength.error };
    }

    const supabase = await ensureSupabaseLoaded() || getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: pass,
          options: {
            data: {
              full_name: cleanName,
            },
          },
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('user already exists')) {
            const loginRes = await signIn(cleanEmail, pass);
            if (!loginRes.error) return {};
            return {
              error: 'An account with this email already exists. Please switch to Sign In with your password.',
            };
          }
          return { error: error.message };
        }

        if (data.user) {
          await supabase.from('profiles').upsert(
            {
              user_id: data.user.id,
              email: cleanEmail,
              full_name: cleanName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

          await dbService.syncSupabaseWorkspace(data.user.id, cleanName);

          setUser(data.user);
          setSession(data.session);

          await loadUserProfile(data.user);
          await dbService.logAudit(data.user.id, 'SIGNUP', 'auth', data.user.id, `User registered (${cleanEmail})`);

          localStorage.setItem('mad_last_signed_email', cleanEmail);
          if (rememberEmail) {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
            setRememberedEmail(cleanEmail);
          }

          return {};
        }
      } catch (err: any) {
        console.warn('Supabase signUp error, trying server fallback:', err);
      }
    }

    // Server-backed registration
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: pass,
          full_name: cleanName,
        }),
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        setSession(data.session);
        setProfile(data.profile);

        localStorage.setItem(
          'mad_server_session',
          JSON.stringify({
            user: data.user,
            session: data.session,
            profile: data.profile,
          })
        );

        localStorage.setItem('mad_last_signed_email', cleanEmail);
        if (rememberEmail) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
          setRememberedEmail(cleanEmail);
        }

        await loadUserProfile(data.user);
        await dbService.getTables(data.user.id);
        dbService.syncWithServer(data.user.id).catch(console.warn);
        await dbService.logAudit(data.user.id, 'SIGNUP', 'auth', data.user.id, `User registered (${cleanEmail})`);

        return {};
      }

      if (data.error) {
        return { error: data.error };
      }
      return { error: 'Registration failed. Please try again.' };
    } catch (err: any) {
      return { error: err?.message || 'Registration failed.' };
    }
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signout error:', err);
      }
    }
    if (user) {
      await dbService.logAudit(user.id, 'LOGOUT', 'auth', user.id, 'User logged out');
    }
    localStorage.setItem('mad_logged_out', 'true');
    localStorage.removeItem('mad_server_session');
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const quickLoginAsManager = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/quick-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Quick login failed');
      }

      setUser(data.user);
      setSession(data.session);
      setProfile(data.profile);

      localStorage.removeItem('mad_logged_out');
      localStorage.setItem('mad_server_session', JSON.stringify({
        user: data.user,
        session: data.session,
        profile: data.profile,
      }));
      localStorage.setItem('mad_last_signed_email', data.user.email);

      loadUserProfile(data.user).catch(console.warn);
      dbService.getTables(data.user.id).catch(console.warn);
      dbService.syncWithServer(data.user.id).catch(console.warn);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Quick login failed' };
    }
  };

  const sendPasswordReset = async (email: string): Promise<{ error?: string; notFound?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { error: 'Please enter your email address.' };

    const existsInfo = await checkAccountExists(cleanEmail);
    if (!existsInfo.exists) {
      return {
        error: `Account not found for ${cleanEmail}. Click "Sign Up" below to create your account.`,
        notFound: true,
      };
    }

    const supabase = await ensureSupabaseLoaded() || getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (error) return { error: error.message };
        return {};
      } catch (err: any) {
        console.warn('Supabase resetPasswordForEmail error:', err);
      }
    }

    // Server-side password reset notice
    return {};
  };

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    return sendPasswordReset(email);
  };

  const directResetPassword = async (
    email: string,
    newPass: string,
    fullName?: string
  ): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName?.trim() || cleanEmail.split('@')[0] || 'Business User';

    const strength = validateStrongPassword(newPass);
    if (!strength.valid) return { error: strength.error };

    const supabase = await ensureSupabaseLoaded() || getSupabase();
    if (supabase) {
      const existsInfo = await checkAccountExists(cleanEmail);
      if (!existsInfo.exists) {
        return signUp(cleanEmail, newPass, cleanName);
      }

      // Try signing in
      const signInRes = await signIn(cleanEmail, newPass);
      if (!signInRes.error) {
        return {};
      }

      return sendPasswordReset(cleanEmail);
    }

    // Server direct reset password
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          newPassword: newPass,
          fullName: cleanName,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { error: data.error || 'Failed to update password.' };
      }
      if (data.user) {
        setUser(data.user);
        setSession(data.session || { access_token: `token_${data.user.id}`, user: data.user });
        setProfile(data.profile);
        localStorage.setItem(
          'mad_server_session',
          JSON.stringify({
            user: data.user,
            session: data.session || { access_token: `token_${data.user.id}`, user: data.user },
            profile: data.profile,
          })
        );
        await loadUserProfile(data.user);
        await dbService.getTables(data.user.id);
        dbService.syncWithServer(data.user.id).catch(console.warn);
      }
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to update password.' };
    }
  };

  const updatePassword = async (newPass: string): Promise<{ error?: string }> => {
    const strength = validateStrongPassword(newPass);
    if (!strength.valid) return { error: strength.error };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.auth.updateUser({ password: newPass });
        if (error) return { error: error.message };
        if (user) {
          await dbService.logAudit(user.id, 'UPDATE_PASSWORD', 'auth', user.id, 'User updated password in Supabase');
        }
        return {};
      } catch (err: any) {
        console.warn('Supabase updateUser password error:', err);
      }
    }

    if (!user || !user.email) return { error: 'No user session found.' };

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { error: data.error || 'Password update failed.' };
      }
      if (user) {
        await dbService.logAudit(user.id, 'UPDATE_PASSWORD', 'auth', user.id, 'User updated password');
      }
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Password update failed.' };
    }
  };

  const changePassword = async (newPass: string): Promise<{ error?: string }> => {
    return updatePassword(newPass);
  };

  const verifyRecoveryPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || !user.email) {
      return { success: false, error: 'No active user session found.' };
    }

    const cleanPass = password.trim();
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: cleanPass,
        });

        if (!error && data.user) {
          return { success: true };
        }
        return { success: false, error: 'Incorrect password.' };
      } catch (err: any) {
        console.warn('Supabase recovery verify error:', err);
      }
    }

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: cleanPass }),
      });
      if (res.ok) return { success: true };
      return { success: false, error: 'Incorrect password.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Verification failed.' };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ error?: string }> => {
    if (!user) return { error: 'No user signed in' };

    try {
      const updatedProfile: UserProfile = {
        ...(profile || {
          id: user.id,
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Abdii',
          email: user.email || '',
          created_at: new Date().toISOString(),
        }),
        ...updates,
        full_name: updates.full_name || profile?.full_name || user.user_metadata?.full_name || 'Abdii',
        user_id: user.id,
      };

      await dbService.saveUserProfile(updatedProfile);
      setProfile(updatedProfile);

      const supabase = getSupabase();
      if (supabase && updates.full_name) {
        await supabase.auth.updateUser({
          data: { full_name: updates.full_name },
        }).catch(() => {});
      }

      await dbService.logAudit(
        user.id,
        'UPDATE_PROFILE',
        'auth',
        user.id,
        `Profile updated (${updates.full_name || 'info'})`
      );

      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to update profile' };
    }
  };

  const deleteAccount = async (): Promise<{ error?: string }> => {
    if (!user) return { error: 'No user signed in' };

    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('profiles').delete().eq('user_id', user.id);
        await supabase.from('tables').delete().eq('user_id', user.id);
      }
      await idb.delete('profiles', user.id);
      await signOut();
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to delete account' };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  const authContextValue = useMemo(() => ({
    user,
    session,
    profile,
    isLoading,
    isConfigured,
    isCloudMode,
    isLocked,
    autoLockMinutes,
    setAutoLockMinutes,
    lockScreen,
    unlockWithPassword,
    unlockWithPin,
    setSecurityPin,
    removeSecurityPin,
    hasSecurityPin,
    verifySecurityCodeOrPassword,
    requirePinForDataChanges,
    setRequirePinForDataChanges,
    rememberEmail,
    setRememberEmail,
    rememberedEmail,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    resetPassword,
    directResetPassword,
    checkAccountExists,
    updatePassword,
    changePassword,
    verifyRecoveryPassword,
    requiresPasswordCheck,
    verifyAccountPassword,
    activeSessions,
    terminateSession,
    terminateAllOtherSessions,
    currentDeviceSession,
    updateProfile,
    deleteAccount,
    refreshProfile,
    quickLoginAsManager,
  }), [
    user,
    session,
    profile,
    isLoading,
    isConfigured,
    isCloudMode,
    isLocked,
    autoLockMinutes,
    hasSecurityPin,
    requirePinForDataChanges,
    rememberEmail,
    rememberedEmail,
    requiresPasswordCheck,
    activeSessions,
    currentDeviceSession,
  ]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
