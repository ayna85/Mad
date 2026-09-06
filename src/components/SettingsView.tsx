import React, { useState } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Globe,
  User,
  Shield,
  Database,
  Trash2,
  Download,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Code,
  Key,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  Cloud,
  CloudOff,
  Clock,
  ShieldCheck,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';
import { SQL_SETUP_SCHEMA } from '../lib/sqlSchema';
import {
  getStoredSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';

export const SettingsView: React.FC = () => {
  const { t, theme, setTheme, language, setLanguage, manualSync, isSyncing, tables } = useApp();
  const {
    user,
    profile,
    updateProfile,
    changePassword,
    deleteAccount,
    signOut,
    isCloudMode,
    autoLockMinutes,
    setAutoLockMinutes,
    lockScreen,
    hasSecurityPin,
    setSecurityPin,
    removeSecurityPin,
    rememberEmail,
    setRememberEmail,
    requirePinForDataChanges,
    setRequirePinForDataChanges,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'appearance' | 'account' | 'security' | 'data' | 'language' | 'sql_schema'
  >('appearance');

  // Account form
  const [fullName, setFullName] = useState(profile?.full_name || 'Abdii');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // PIN Code form
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [showPinInputs, setShowPinInputs] = useState(false);

  // Cloud Config State
  const storedConfig = getStoredSupabaseConfig();
  const [cloudUrl, setCloudUrl] = useState(storedConfig.url || '');
  const [cloudAnonKey, setCloudAnonKey] = useState(storedConfig.anonKey || '');
  const [testingCloud, setTestingCloud] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete account confirmation
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // SQL Schema copied state
  const [copiedSql, setCopiedSql] = useState(false);

  const handleTestAndSaveCloud = async () => {
    if (!cloudUrl.trim() || !cloudAnonKey.trim()) {
      setCloudStatusMsg({ type: 'error', text: 'Please provide both Supabase Project URL and Anon Public Key.' });
      return;
    }
    setTestingCloud(true);
    setCloudStatusMsg(null);
    try {
      const res = await testSupabaseConnection(cloudUrl.trim(), cloudAnonKey.trim());
      if (res.success) {
        saveCustomSupabaseConfig(cloudUrl.trim(), cloudAnonKey.trim());
        setCloudStatusMsg({ type: 'success', text: 'Supabase cloud connection verified and saved! Reloading...' });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setCloudStatusMsg({ type: 'error', text: res.message || 'Connection test failed.' });
      }
    } catch (err: any) {
      setCloudStatusMsg({ type: 'error', text: err?.message || 'Connection test failed.' });
    } finally {
      setTestingCloud(false);
    }
  };

  const handleDisconnectCloud = () => {
    clearCustomSupabaseConfig();
    setCloudUrl('');
    setCloudAnonKey('');
    setCloudStatusMsg({ type: 'success', text: 'Switched back to local storage engine.' });
    setTimeout(() => window.location.reload(), 800);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      await updateProfile({ full_name: fullName });
      setProfileMsg('Profile updated successfully!');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err: any) {
      setProfileMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match. Please verify your entries.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await changePassword(newPassword);
      if (res?.error) {
        setPasswordMsg(res.error);
        setPasswordSuccess(false);
      } else {
        setPasswordMsg('Password updated successfully!');
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setPasswordMsg('');
          setPasswordSuccess(false);
        }, 3500);
      }
    } catch (err: any) {
      setPasswordMsg(err.message || 'Failed to update password.');
      setPasswordSuccess(false);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg('');
    setPinSuccess(false);

    if (!/^\d{4,8}$/.test(pinInput.trim())) {
      setPinMsg('PIN must be 4 to 8 digits (numeric characters only).');
      return;
    }
    if (pinInput !== pinConfirmInput) {
      setPinMsg('PIN codes do not match.');
      return;
    }

    setIsSavingPin(true);
    try {
      const res = await setSecurityPin(pinInput.trim());
      if (res.success) {
        setPinSuccess(true);
        setPinMsg('Security PIN code saved successfully!');
        setPinInput('');
        setPinConfirmInput('');
        setShowPinInputs(false);
        setTimeout(() => {
          setPinMsg('');
          setPinSuccess(false);
        }, 3500);
      } else {
        setPinMsg(res.error || 'Failed to save security PIN.');
      }
    } catch (err: any) {
      setPinMsg(err.message || 'Failed to save PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleRemovePin = async () => {
    if (
      window.confirm(
        'Are you sure you want to remove your Security PIN? You will need your account password to unlock.'
      )
    ) {
      await removeSecurityPin();
      setPinSuccess(true);
      setPinMsg('Security PIN code removed.');
      setTimeout(() => {
        setPinMsg('');
        setPinSuccess(false);
      }, 3000);
    }
  };

  const handleDeleteAccountSubmit = async () => {
    if (deleteConfirmationText !== 'DELETE') return;
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleExportAllData = async () => {
    const dataStr = JSON.stringify({ tables, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MAD_backup_all_tables_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const navTabs = [
    { id: 'appearance', label: t.settings_appearance, icon: Moon },
    { id: 'account', label: t.settings_account, icon: User },
    { id: 'security', label: t.settings_security, icon: Shield },
    { id: 'data', label: t.settings_data, icon: Database },
    { id: 'language', label: t.settings_language, icon: Globe },
    { id: 'sql_schema', label: 'Supabase SQL Setup', icon: Code },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
          {t.nav_settings}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure application appearance, database connections, and user preferences
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs md:flex-row dark:border-slate-800 dark:bg-slate-900">
        {/* Left Subnav */}
        <div className="w-full border-b border-slate-200 p-3 md:w-56 md:border-b-0 md:border-r dark:border-slate-800">
          <nav className="space-y-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Tab Content */}
        <div className="flex-1 p-6">
          {/* 1. APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Theme Mode</h2>
                <p className="text-xs text-slate-500">Choose your visual appearance preference</p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-xs font-bold transition ${
                      theme === 'light'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 dark:border-blue-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
                    }`}
                  >
                    <Sun className="h-6 w-6 text-amber-500" />
                    <span>Light Mode</span>
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-xs font-bold transition ${
                      theme === 'dark'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
                    }`}
                  >
                    <Moon className="h-6 w-6 text-indigo-400" />
                    <span>Dark Mode</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Profile Information
                </h2>
                <p className="text-xs text-slate-500">Update your name and personal details</p>
              </div>

              {profileMsg && (
                <div className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                  {profileMsg}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10 w-full max-w-md rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.email || 'abdii@madbusiness.com'}
                    className="h-10 w-full max-w-md rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95"
                >
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </form>

              {/* Danger Zone */}
              <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                <h3 className="text-xs font-bold text-red-600">Danger Zone</h3>
                <p className="text-[11px] text-slate-500">
                  Permanently delete your account and all associated spreadsheets
                </p>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
                >
                  {t.delete_account}
                </button>
              </div>
            </div>
          )}

          {/* 3. SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Security & Session Protection
                </h2>
                <p className="text-xs text-slate-500">
                  Configure idle auto-lock timeout, 4-digit security PIN codes, and sensitive change safeguards.
                </p>
              </div>

              {/* CARD 1: AUTO-LOCK TIMEOUT (5 MIN DEFAULT) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Auto-Lock Timeout</span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                          {autoLockMinutes === 0 ? 'Disabled' : `${autoLockMinutes} Min`}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Locks the screen when inactive or returning to the app after the selected duration.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => lockScreen()}
                    className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition"
                  >
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                    <span>Lock Screen Now</span>
                  </button>
                </div>

                {/* Duration Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
                  {[
                    { label: 'Disabled (Default)', val: 0, badge: 'Persistent' },
                    { label: '5 Min', val: 5 },
                    { label: '10 Min', val: 10 },
                    { label: '15 Min', val: 15 },
                    { label: '30 Min', val: 30 },
                    { label: '1 Hour', val: 60 },
                    { label: '2 Hours', val: 120 },
                  ].map((opt) => {
                    const isSelected = autoLockMinutes === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setAutoLockMinutes(opt.val)}
                        className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-xs font-bold transition border ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`mt-1 text-[9px] uppercase tracking-wider font-extrabold ${
                              isSelected ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CARD 2: QUICK SECURITY PIN CODE (SET CODE) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Quick Security PIN Code</span>
                        {hasSecurityPin ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <ShieldCheck className="h-3 w-3" /> Configured
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Not Set
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Set a 4 to 8 digit numeric passcode to unlock quickly without typing your long account password.
                      </p>
                    </div>
                  </div>

                  {!showPinInputs && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPinInputs(true);
                          setPinMsg('');
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95 transition"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{hasSecurityPin ? 'Change PIN Code' : 'Set PIN Code'}</span>
                      </button>
                      {hasSecurityPin && (
                        <button
                          type="button"
                          onClick={handleRemovePin}
                          className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {pinMsg && (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                      pinSuccess
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                    }`}
                  >
                    {pinSuccess ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <span>{pinMsg}</span>
                  </div>
                )}

                {/* Form to set/change PIN */}
                {showPinInputs && (
                  <form onSubmit={handleSavePin} className="max-w-md rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {hasSecurityPin ? 'Update Security PIN' : 'Set New Security PIN (4–8 Digits)'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Enter PIN Code (Numbers only)
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={8}
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 1234"
                          className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-center text-sm font-bold tracking-widest text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Confirm PIN Code
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={8}
                          value={pinConfirmInput}
                          onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="Re-enter PIN"
                          className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-center text-sm font-bold tracking-widest text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPinInputs(false);
                          setPinInput('');
                          setPinConfirmInput('');
                        }}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPin || !pinInput || pinInput.length < 4}
                        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{isSavingPin ? 'Saving...' : 'Save PIN'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* CARD 3: EMAIL AUTO-FILL & SENSITIVE ACTION GATING */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Email Auto-fill & Sensitive Action Protection
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Configure convenience and security authorizations across the application.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Email Auto-Fill Switch */}
                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 cursor-pointer">
                    <div className="space-y-0.5 pr-4">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Auto-fill email address on login and lock screen
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Remembers your email address for faster authentication without typing it every time.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  {/* Sensitive Action Safeguard */}
                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 cursor-pointer">
                    <div className="space-y-0.5 pr-4">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Require Password / PIN verification for sensitive data changes
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Prompts for your security code before destructive operations (e.g., clearing all records, restoring backups).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={requirePinForDataChanges}
                      onChange={(e) => setRequirePinForDataChanges(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              {/* CARD 4: UPDATE ACCOUNT PASSWORD */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Account Password
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Update your primary account login password for {user?.email}.
                    </p>
                  </div>
                </div>

                {passwordMsg && (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                      passwordSuccess
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                    }`}
                  >
                    {passwordSuccess ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span>{passwordMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSavePassword} className="max-w-md space-y-4 pt-1">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-3 pr-10 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-3 pr-10 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="mt-1 text-[11px] font-semibold text-red-500">
                        Passwords do not match
                      </p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>{isUpdatingPassword ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 4. DATA & SYNCHRONIZATION */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Data & Offline Synchronization
                </h2>
                <p className="text-xs text-slate-500">
                  Manage backups, offline cache, and force sync with Supabase PostgreSQL
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Force Database Sync
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Synchronize pending local IndexedDB modifications to Supabase
                    </p>
                  </div>
                  <button
                    onClick={manualSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Export All Workspaces (JSON)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Download a full JSON archive containing all spreadsheets and rows
                    </p>
                  </div>
                  <button
                    onClick={handleExportAllData}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. LANGUAGE */}
          {activeTab === 'language' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Language Preference / ቋንቋ
                </h2>
                <p className="text-xs text-slate-500">
                  Switch interface language between English and Amharic
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLanguage('en')}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-xs font-bold transition ${
                    language === 'en'
                      ? 'border-blue-600 bg-blue-50/60 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                >
                  <Globe className="h-6 w-6 text-blue-600" />
                  <span className="text-sm">English (EN)</span>
                </button>

                <button
                  onClick={() => setLanguage('am')}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-xs font-bold transition ${
                    language === 'am'
                      ? 'border-blue-600 bg-blue-50/60 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                >
                  <Globe className="h-6 w-6 text-indigo-600" />
                  <span className="text-sm">አማርኛ (Amharic)</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. SUPABASE SQL SCHEMA SETUP & CLOUD CONFIG */}
          {activeTab === 'sql_schema' && (
            <div className="space-y-6">
              {/* Supabase Connection Setup Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isCloudMode ? (
                      <Cloud className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Database className="h-5 w-5 text-blue-500" />
                    )}
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Supabase Cloud Credentials & Status
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {isCloudMode
                          ? 'Connected to live Supabase PostgreSQL database'
                          : 'Currently using local IndexedDB high-speed offline engine'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      isCloudMode
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    ● {isCloudMode ? 'Cloud Connected' : 'Local Mode'}
                  </span>
                </div>

                {cloudStatusMsg && (
                  <div
                    className={`mb-3 flex items-start gap-2 rounded-xl p-3 text-xs font-semibold ${
                      cloudStatusMsg.type === 'success'
                        ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
                    }`}
                  >
                    {cloudStatusMsg.type === 'success' ? (
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    )}
                    <span>{cloudStatusMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Supabase URL
                    </label>
                    <input
                      type="url"
                      value={cloudUrl}
                      onChange={(e) => setCloudUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Supabase Anon / Public API Key
                    </label>
                    <input
                      type="password"
                      value={cloudAnonKey}
                      onChange={(e) => setCloudAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testingCloud}
                    onClick={handleTestAndSaveCloud}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-500 disabled:opacity-50"
                  >
                    {testingCloud ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5" />
                    )}
                    <span>{testingCloud ? 'Testing Connection...' : 'Save & Connect Supabase'}</span>
                  </button>

                  {storedConfig.isConfigured && (
                    <button
                      type="button"
                      onClick={handleDisconnectCloud}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      Disconnect Cloud
                    </button>
                  )}
                </div>
              </div>

              {/* PostgreSQL Schema */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      PostgreSQL Database Schema & RLS Setup
                    </h2>
                    <p className="text-xs text-slate-500">
                      Paste this into your Supabase project's SQL Editor to set up all tables, indexes, and Row Level Security policies.
                    </p>
                  </div>

                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                  >
                    {copiedSql ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
                  </button>
                </div>

                <div className="relative max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-400">
                  <pre>{SQL_SETUP_SCHEMA}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Account Confirmation
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {t.delete_account_confirm} Type <span className="font-bold text-red-600">DELETE</span> to confirm.
            </p>

            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="DELETE"
              className="mt-4 h-10 w-full rounded-xl border border-red-300 bg-red-50/50 px-3 text-xs font-bold text-red-900 focus:outline-none dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            />

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmationText !== 'DELETE' || isDeletingAccount}
                onClick={handleDeleteAccountSubmit}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-red-700 disabled:opacity-40"
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
