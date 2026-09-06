import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  User,
  UserCheck,
  ArrowRight,
  Shield,
  Globe,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X,
  Database,
  Cloud,
  CloudOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth, validateStrongPassword } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import {
  getStoredSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';
import { MAD_PRODUCT_IMAGE } from '../assets/productImage';

export const AuthView: React.FC = () => {
  const {
    signIn,
    signUp,
    sendPasswordReset,
    directResetPassword,
    checkAccountExists,
    isConfigured,
    isCloudMode,
    rememberedEmail,
    rememberEmail,
    setRememberEmail,
    quickLoginAsManager,
  } = useAuth();
  const { t, language, setLanguage } = useApp();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');

  // Form states - auto-fills remembered email or abdiu3725@gmail.com
  const [email, setEmail] = useState(() => {
    return rememberedEmail || localStorage.getItem('mad_last_signed_email') || 'abdiu3725@gmail.com';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('Abdii');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Direct reset states for 'forgot' mode
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    if (!email && rememberedEmail) {
      setEmail(rememberedEmail);
    }
  }, [rememberedEmail, email]);

  // Cloud config expandable settings
  const storedConfig = getStoredSupabaseConfig();
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(storedConfig.url || '');
  const [customAnonKey, setCustomAnonKey] = useState(storedConfig.anonKey || '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Status feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [errorType, setErrorType] = useState<'none' | 'incorrect_password' | 'account_not_found'>('none');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password criteria checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score; // 0 to 4
  };

  const strength = calculatePasswordStrength(password);

  const handleTestAndSaveCloud = async () => {
    if (!customUrl.trim() || !customAnonKey.trim()) {
      setCloudMsg({ type: 'error', text: 'Please provide both Supabase URL and Anon Key.' });
      return;
    }

    setTestingConnection(true);
    setCloudMsg(null);
    try {
      const res = await testSupabaseConnection(customUrl.trim(), customAnonKey.trim());
      if (res.success) {
        saveCustomSupabaseConfig(customUrl.trim(), customAnonKey.trim());
        setCloudMsg({ type: 'success', text: 'Connected to Supabase successfully! Refreshing...' });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setCloudMsg({ type: 'error', text: res.message || 'Connection test failed.' });
      }
    } catch (err: any) {
      setCloudMsg({ type: 'error', text: err?.message || 'Connection test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearCloud = () => {
    clearCustomSupabaseConfig();
    setCustomUrl('');
    setCustomAnonKey('');
    setCloudMsg({ type: 'success', text: 'Switched to high-speed Local Engine.' });
    setTimeout(() => window.location.reload(), 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setErrorType('none');
    setSuccessMsg('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please provide a valid email address.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      const passCheck = validateStrongPassword(password);
      if (!passCheck.valid) {
        setErrorMsg(passCheck.error || 'Please provide a stronger password.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your password.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await signUp(email.trim(), password, fullName.trim());
        if (res?.error) {
          setErrorMsg(res.error);
          if (res.error.toLowerCase().includes('already exists') || res.error.toLowerCase().includes('already registered')) {
            setErrorType('incorrect_password');
          }
        } else {
          setSuccessMsg('Account created successfully! Logging you in...');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to create account.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === 'login') {
      if (!password) {
        setErrorMsg('Please enter your password.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await signIn(email.trim(), password);
        if (res?.error) {
          setErrorMsg(res.error);
          if (res.accountNotFound || res.error.toLowerCase().includes('not found')) {
            setErrorType('account_not_found');
          } else if (res.incorrectPassword || res.error.toLowerCase().includes('incorrect password') || res.error.toLowerCase().includes('invalid')) {
            setErrorType('incorrect_password');
          }
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Login failed. Please check your credentials.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === 'forgot') {
      if (!resetNewPassword) {
        // Just checking email / sending notice
        setIsLoading(true);
        try {
          const res = await sendPasswordReset(email.trim());
          if (res?.error) {
            setErrorMsg(res.error);
            if (res.notFound) {
              setErrorType('account_not_found');
            }
          } else {
            setSuccessMsg(`Please enter your new password below to reset and sign in immediately.`);
          }
        } catch (err: any) {
          setErrorMsg(err?.message || 'Failed to process request.');
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Setting new password directly
      const passCheck = validateStrongPassword(resetNewPassword);
      if (!passCheck.valid) {
        setErrorMsg(passCheck.error || 'Password must be at least 8 characters long.');
        return;
      }

      if (resetConfirmPassword && resetNewPassword !== resetConfirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your new password.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await directResetPassword(email.trim(), resetNewPassword, fullName.trim());
        if (res?.error) {
          setErrorMsg(res.error);
        } else {
          setSuccessMsg('Password has been successfully updated! Signing you in...');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to reset password.');
      } finally {
        setIsLoading(false);
      }
      return;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0F172A] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-[#1E293B]/70 px-4 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-black text-white shadow-md shadow-blue-500/20">
            M
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white">MAD Business</span>
            <span className="ml-2 hidden rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 sm:inline-block">
              Miyawa 3A
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Storage Mode Badge */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
              isCloudMode
                ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
                : 'border-blue-500/30 bg-blue-950/40 text-blue-300'
            }`}
          >
            {isCloudMode ? <Cloud className="h-3 w-3" /> : <Database className="h-3 w-3" />}
            <span>{isCloudMode ? 'Supabase Cloud Connected' : 'Local Storage Engine Ready'}</span>
          </div>

          <button
            onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            title="Switch Language / ቋንቋ ቀይር"
          >
            <Globe className="h-3.5 w-3.5 text-blue-400" />
            <span>{language === 'en' ? 'አማርኛ' : 'EN'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-[#1E293B] shadow-2xl md:grid-cols-12">
          {/* Left Hero & Product Showcase (5 cols) */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 p-8 md:col-span-5 md:flex">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-xs">
                <Shield className="h-3.5 w-3.5 text-emerald-300" />
                <span>Enterprise Business Architecture</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">MAD Miyawa 3A</h2>
              <p className="text-xs leading-relaxed text-blue-100/90">
                Automated business calculations, real-time formula computation, column formatting, and secure local & cloud persistence.
              </p>
            </div>

            {/* Product Image Showcase */}
            <div className="my-6 flex justify-center">
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-2 shadow-2xl backdrop-blur-xs">
                <img
                  src={MAD_PRODUCT_IMAGE}
                  alt="MAD Miyawa 3A"
                  className="h-44 w-52 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="space-y-1 rounded-xl bg-black/25 p-3 text-xs text-blue-200 backdrop-blur-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Manager: Abdii</span>
                <span className="text-[11px] text-emerald-300 font-bold">● Active Engine</span>
              </div>
              <p className="text-[10px] text-blue-200/80">
                {isCloudMode ? 'Supabase PostgreSQL Cloud Active' : 'IndexedDB Cryptographic Engine'}
              </p>
            </div>
          </div>

          {/* Right Auth Form (7 cols) */}
          <div className="flex flex-col justify-center p-6 sm:p-10 md:col-span-7">
            {/* Mobile Header with Product Showcase */}
            <div className="mb-6 md:hidden flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-emerald-500/40 bg-emerald-950/40 shadow-sm">
                <img
                  src={MAD_PRODUCT_IMAGE}
                  alt="MAD Ma'ed Table Salt"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">MAD Miyawa 3A</h2>
                <p className="text-[11px] text-slate-400">Enterprise Business Calculations</p>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
              <button
                type="button"
                id="tab-auth-login"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-auth-signup"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'signup'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account (Sign Up)
              </button>
            </div>

            {/* 1-Click Instant Workspace Entry for Manager Abdii */}
            <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs shadow-lg shadow-emerald-950/50">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5 text-slate-200">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-emerald-300">Manager Abdii Workspace</div>
                    <div className="text-[11px] text-slate-300">abdiu3725@gmail.com</div>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-open-workspace-abdii"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    setErrorMsg('');
                    const res = await quickLoginAsManager();
                    if (!res.success) {
                      setErrorMsg(res.error || 'Failed to open workspace');
                    }
                    setIsLoading(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition active:scale-98"
                >
                  <span>⚡ Open Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Header */}
            <div className="mb-5">
              <h3 className="text-xl font-extrabold text-white">
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Account (Sign Up)'}
                {mode === 'forgot' && 'Reset Password'}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                {mode === 'login' && 'Enter your credentials to access MAD Miyawa 3A spreadsheets'}
                {mode === 'signup' && 'Sign up with your credentials to start managing business calculations'}
                {mode === 'forgot' && 'Enter your registered email address to receive password reset instructions'}
              </p>
            </div>

            {/* Error Message with Interactive Resolution Buttons */}
            {errorMsg && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3.5 text-xs font-semibold text-red-200 shadow-md">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <div className="flex-1 space-y-1">
                    <p className="font-bold text-red-100">{errorMsg}</p>
                  </div>
                </div>

                {/* Quick resolution trigger: Account Not Found -> 1-Click Sign Up */}
                {(errorType === 'account_not_found' || errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('sign up')) && mode === 'login' && (
                  <div className="mt-3 pt-2.5 border-t border-red-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-[11px] text-red-300">Account does not exist yet for this email?</span>
                    <button
                      type="button"
                      id="btn-fix-account-not-found"
                      onClick={() => {
                        setMode('signup');
                        setErrorMsg('');
                        setErrorType('none');
                        if (password && !confirmPassword) setConfirmPassword(password);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Create Account (Sign Up)</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Quick resolution trigger: Incorrect Password -> 1-Click Reset Password */}
                {(errorType === 'incorrect_password' || errorMsg.toLowerCase().includes('incorrect password') || errorMsg.toLowerCase().includes('invalid')) && mode === 'login' && (
                  <div className="mt-3 pt-2.5 border-t border-red-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-[11px] text-red-300">Forgot or want to change your password?</span>
                    <button
                      type="button"
                      id="btn-fix-incorrect-password"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMsg('');
                        setErrorType('none');
                        setResetNewPassword('');
                        setResetConfirmPassword('');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-amber-500 transition"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Set / Reset Password Now</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {(errorMsg.toLowerCase().includes('already exists') || errorMsg.toLowerCase().includes('already registered')) && mode === 'signup' && (
                  <div className="mt-3 pt-2.5 border-t border-red-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-[11px] text-red-300">Account already registered?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg('');
                        setErrorType('none');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
                    >
                      <span>Sign In with Password</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {errorMsg.toLowerCase().includes('supabase') && (
                  <div className="mt-3 pt-2.5 border-t border-red-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-[11px] text-red-300">Configure Supabase credentials or use Local Server:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCloudConfig(true);
                        setErrorMsg('');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-500 transition"
                    >
                      <Cloud className="h-3.5 w-3.5" />
                      <span>Open Supabase Settings</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-3 text-xs font-semibold text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name for Sign Up */}
              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="input-auth-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Abdii"
                      className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-3 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="input-auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-3 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Password for Login or Sign Up */}
              {mode !== 'forgot' && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      Password <span className="text-red-400">*</span>
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="input-auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Strong password (e.g. Abdi@1234)' : 'Enter your password'}
                      className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-10 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter & Requirements (for Sign Up) */}
                  {mode === 'signup' && (
                    <div className="mt-2 space-y-2">
                      {/* Strength Visual Bar */}
                      {password.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                strength >= 1 ? 'bg-red-500 w-1/4' : 'w-0'
                              }`}
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                strength >= 2 ? 'bg-amber-500 w-1/4' : 'w-0'
                              }`}
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                strength >= 3 ? 'bg-blue-500 w-1/4' : 'w-0'
                              }`}
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                strength >= 4 ? 'bg-emerald-500 w-1/4' : 'w-0'
                              }`}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-medium text-slate-400">
                            <span>Password Strength:</span>
                            <span className="font-bold text-slate-200">
                              {strength <= 1 && 'Weak'}
                              {strength === 2 && 'Fair'}
                              {strength === 3 && 'Good'}
                              {strength >= 4 && 'Strong'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Password Requirements Checklist */}
                      <div className="rounded-lg bg-slate-900/60 p-2.5 text-[11px] text-slate-400 border border-slate-800">
                        <p className="font-bold text-slate-300 mb-1">Password Requirements:</p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          <li className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {hasMinLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            <span>At least 8 characters</span>
                          </li>
                          <li className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            <span>1 uppercase letter (A-Z)</span>
                          </li>
                          <li className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            <span>1 lowercase letter (a-z)</span>
                          </li>
                          <li className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            <span>1 number (0-9)</span>
                          </li>
                          <li className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            <span>Special character (e.g. @#$!)</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm Password for Sign Up */}
              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="input-auth-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-10 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-[11px] font-semibold text-red-400">
                      Passwords do not match
                    </p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <Check className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>
              )}

              {/* Direct Reset Password Fields (for Forgot/Reset Mode) */}
              {mode === 'forgot' && (
                <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <Lock className="h-4 w-4" />
                    <span>Enter Your New Password to Set & Access Account</span>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-300">
                      New Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="input-auth-reset-new-password"
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Enter new password (e.g. Abdi@1234)"
                        className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-10 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-amber-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-300">
                      Confirm New Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="input-auth-reset-confirm-password"
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Re-type your new password"
                        className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-10 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-amber-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    {resetConfirmPassword && resetNewPassword !== resetConfirmPassword && (
                      <p className="mt-1 text-[11px] font-semibold text-red-400">Passwords do not match</p>
                    )}
                    {resetConfirmPassword && resetNewPassword === resetConfirmPassword && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <Check className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="btn-auth-submit"
                type="submit"
                disabled={isLoading}
                className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60 ${
                  mode === 'forgot'
                    ? 'bg-amber-600 shadow-amber-600/30 hover:bg-amber-500'
                    : 'bg-blue-600 shadow-blue-600/30 hover:bg-blue-500'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing authentication...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'login' && 'Sign In to MAD'}
                      {mode === 'signup' && 'Create Account & Sign In'}
                      {mode === 'forgot' && 'Set New Password & Sign In'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Optional Cloud Connection Setup Toggle */}
            <div className="mt-4 border-t border-slate-800/80 pt-3">
              <button
                type="button"
                onClick={() => setShowCloudConfig(!showCloudConfig)}
                className="flex w-full items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-200"
              >
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-blue-400" />
                  <span>Cloud Database Settings (Optional Supabase Sync)</span>
                </div>
                {showCloudConfig ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>

              {showCloudConfig && (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    By default, MAD Miyawa 3A operates with full offline persistence. If you have a Supabase project, you can paste its credentials below to enable multi-device cloud synchronization.
                  </p>

                  {cloudMsg && (
                    <div
                      className={`flex items-start gap-2 rounded-lg p-2 text-[11px] font-semibold ${
                        cloudMsg.type === 'success'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-950/60 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {cloudMsg.type === 'success' ? (
                        <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
                      )}
                      <span>{cloudMsg.text}</span>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Supabase Project URL
                    </label>
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Supabase Anon / Public API Key
                    </label>
                    <input
                      type="password"
                      value={customAnonKey}
                      onChange={(e) => setCustomAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={testingConnection}
                      onClick={handleTestAndSaveCloud}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      {testingConnection ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Cloud className="h-3.5 w-3.5" />
                      )}
                      <span>{testingConnection ? 'Testing...' : 'Save & Connect Cloud'}</span>
                    </button>

                    {storedConfig.isConfigured && (
                      <button
                        type="button"
                        onClick={handleClearCloud}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                      >
                        Disconnect Cloud
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Mode Switch Links */}
            <div className="mt-5 border-t border-slate-800 pt-4 text-center text-xs text-slate-400">
              {mode === 'login' && (
                <div>
                  Don't have an account?{' '}
                  <button
                    id="btn-switch-to-signup"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    Sign Up Now
                  </button>
                </div>
              )}

              {(mode === 'signup' || mode === 'forgot') && (
                <div>
                  Already have an account?{' '}
                  <button
                    id="btn-switch-to-login"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <footer className="border-t border-slate-800/60 py-3 text-center text-[11px] text-slate-500">
        MAD Miyawa 3A • Business Management System & Automated Spreadsheet Calculations
      </footer>
    </div>
  );
};

