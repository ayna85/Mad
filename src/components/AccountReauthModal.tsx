import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Sparkles, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MAD_PRODUCT_IMAGE } from '../assets/productImage';

export const AccountReauthModal: React.FC = () => {
  const { user, verifyAccountPassword, requiresPasswordCheck, profile } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!requiresPasswordCheck || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyAccountPassword(cleanPass);
      if (!res.success) {
        setErrorMessage(res.error || 'Incorrect password. Please try again.');
      } else {
        setPassword('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      id="account-reauth-modal-overlay"
      className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        id="account-reauth-modal-card"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900 p-7 text-white shadow-2xl ring-1 ring-white/10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 p-2 ring-1 ring-blue-500/40">
            <img
              src={MAD_PRODUCT_IMAGE}
              alt="MAD Logo"
              className="h-full w-full rounded-xl object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
              <Lock className="h-3.5 w-3.5" />
            </div>
          </div>

          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-400">
            Security Re-Authentication
          </span>
          <h2 className="mt-2 text-lg font-extrabold tracking-tight text-white sm:text-xl">
            Session Locked (2 Minutes Away)
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            You were inactive or away from the application. Please enter your account password to resume your workspace.
          </p>
        </div>

        {/* User Identity Pill */}
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-xs shadow-xs">
            {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-200">
              {profile?.full_name || 'Account Owner'}
            </p>
            <p className="truncate text-[11px] text-slate-400 font-mono">
              {user.email}
            </p>
          </div>
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-300">
              Account Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyRound className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="input-reauth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-10 text-xs font-medium text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            id="btn-submit-reauth"
            type="submit"
            disabled={isVerifying}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Verifying Account...
              </span>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Verify Password & Unlock</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-[10px] text-slate-500">
            Protected by Miyawa 3A Multi-Sync Security • Secure Inactivity Sentinel
          </p>
        </div>
      </div>
    </div>
  );
};
