import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LockScreen: React.FC = () => {
  const {
    user,
    profile,
    unlockWithPassword,
    unlockWithPin,
    setSecurityPin,
    hasSecurityPin,
    signOut,
    autoLockMinutes,
    sendPasswordReset,
  } = useAuth();

  // Mode: 'password' | 'pin' | 'setup_pin'
  const [unlockMode, setUnlockMode] = useState<'password' | 'pin' | 'setup_pin'>(() => {
    return hasSecurityPin ? 'pin' : 'password';
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Sync mode if PIN state updates
  useEffect(() => {
    if (hasSecurityPin && unlockMode !== 'setup_pin') {
      setUnlockMode('pin');
    }
  }, [hasSecurityPin]);

  // Auto-focus on mount
  useEffect(() => {
    if (unlockMode === 'password' && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [unlockMode]);

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await unlockWithPassword(password);
      if (!res.success) {
        setErrorMsg(res.error || 'Incorrect password.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unlock failed.');
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async (pinValue?: string) => {
    const code = pinValue !== undefined ? pinValue : pin;
    if (!code || code.length < 4) {
      setErrorMsg('Please enter your 4 to 8 digit security PIN code.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await unlockWithPin(code);
      if (!res.success) {
        setErrorMsg(res.error || 'Incorrect PIN code.');
        setPin('');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unlock failed.');
      setPin('');
      setIsSubmitting(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    setErrorMsg('');
    if (pin.length < 8) {
      const nextPin = pin + digit;
      setPin(nextPin);
      // If reached standard 4-digit PIN and matches, or user can click unlock
      if (nextPin.length >= 4 && nextPin.length <= 6) {
        // Auto-check PIN when 4 or 6 digits entered
        handlePinSubmit(nextPin);
      }
    }
  };

  const handleKeypadDelete = () => {
    setErrorMsg('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setErrorMsg('');
    setPin('');
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(newPin)) {
      setErrorMsg('Security PIN must be 4 to 8 digits (numbers only).');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('PIN codes do not match.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await setSecurityPin(newPin);
      if (res.success) {
        setSuccessMsg('Security PIN successfully configured! Unlocking...');
        setTimeout(async () => {
          await unlockWithPin(newPin);
        }, 500);
      } else {
        setErrorMsg(res.error || 'Failed to save security PIN.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save PIN.');
      setIsSubmitting(false);
    }
  };

  const handleSendReset = async () => {
    if (!user?.email) return;
    setIsSubmitting(true);
    const res = await sendPasswordReset(user.email);
    setIsSubmitting(false);
    if (!res.error) {
      setResetSent(true);
    } else {
      setErrorMsg(res.error);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Business User';
  const displayEmail = user?.email || 'authenticated@mad.corp';
  const initial = displayName.charAt(0).toUpperCase() || 'M';

  return (
    <div
      id="mad-lock-screen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-white shadow-2xl">
        {/* Top Header Banner with Brand & Salt Product */}
        <div className="relative bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 pb-5 text-center">
          {/* Subtle background glow */}
          <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-blue-400/20 blur-2xl"></div>
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl"></div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Brand Logo & Tag */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-black tracking-tighter text-white drop-shadow-sm">
                MAD
              </span>
              <span className="h-4 w-px bg-blue-300/40"></span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-blue-200">
                Miyawa 3A
              </span>
            </div>

            {/* Lock Icon with Pulsing Halo */}
            <div className="relative my-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-4 ring-white/15 backdrop-blur-sm shadow-inner">
              <Lock className="h-7 w-7 text-amber-300 animate-pulse" />
            </div>

            <h2 className="text-lg font-extrabold text-white">
              Application Locked
            </h2>
            <div className="mt-1 flex items-center gap-1.5 rounded-full bg-blue-950/60 px-3 py-1 text-[11px] font-semibold text-blue-200 border border-blue-400/20">
              <Clock className="h-3 w-3 text-blue-300" />
              <span>
                Protected after {autoLockMinutes > 0 ? `${autoLockMinutes} min` : '5 min'} of inactivity
              </span>
            </div>
          </div>
        </div>

        {/* User Card & Auto-filled Credentials info */}
        <div className="border-b border-slate-800 bg-slate-900/90 px-6 py-3.5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-sm font-black text-white shadow-md ring-2 ring-blue-400/40">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-100">{displayName}</p>
            <p className="truncate text-[11px] font-medium text-slate-400">
              {displayEmail}
            </p>
          </div>
          <div className="shrink-0 rounded-lg bg-slate-800/80 px-2 py-1 text-[10px] font-bold text-emerald-400 border border-slate-700 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            <span>Active Session</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-5">
          {/* Feedback alerts */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-xs font-semibold text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-3 text-xs font-semibold text-emerald-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: PIN CODE UNLOCK */}
          {unlockMode === 'pin' && (
            <div className="space-y-4">
              <div className="text-center">
                <label className="text-xs font-bold text-slate-300">
                  Enter 4–8 Digit Security PIN Code
                </label>
                <p className="text-[11px] text-slate-500">
                  Quick access code for MAD workspace
                </p>
              </div>

              {/* PIN Dots Display */}
              <div className="flex justify-center items-center gap-2.5 py-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`h-4 w-4 rounded-full border transition-all ${
                        isFilled
                          ? 'border-blue-400 bg-blue-500 shadow-sm shadow-blue-500/50 scale-110'
                          : 'border-slate-700 bg-slate-800/80'
                      }`}
                    />
                  );
                })}
              </div>

              {/* PIN Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    disabled={isSubmitting}
                    className="flex h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 text-base font-bold text-white transition hover:border-blue-500 hover:bg-blue-600/30 active:scale-95 disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  disabled={isSubmitting || !pin}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/30 text-xs font-bold text-slate-400 transition hover:bg-slate-800 active:scale-95 disabled:opacity-30"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  disabled={isSubmitting}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 text-base font-bold text-white transition hover:border-blue-500 hover:bg-blue-600/30 active:scale-95 disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadDelete}
                  disabled={isSubmitting || !pin}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/30 text-xs font-bold text-slate-400 transition hover:bg-slate-800 active:scale-95 disabled:opacity-30"
                >
                  ⌫
                </button>
              </div>

              {/* Manual Unlock Button if needed */}
              <button
                type="button"
                onClick={() => handlePinSubmit()}
                disabled={isSubmitting || pin.length < 4}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition"
              >
                <Unlock className="h-4 w-4" />
                <span>{isSubmitting ? 'Unlocking...' : 'Unlock Workspace'}</span>
              </button>

              {/* Switch to Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setUnlockMode('password');
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Use Account Password instead
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setUnlockMode('setup_pin');
                  }}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Change PIN Code
                </button>
              </div>
            </div>
          )}

          {/* MODE 2: ACCOUNT PASSWORD UNLOCK */}
          {unlockMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">
                  Account Password for {displayEmail}
                </label>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    id="lock-screen-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Enter password to unlock"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-3.5 pr-11 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-lock-screen-unlock"
                disabled={isSubmitting || !password}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition"
              >
                <Unlock className="h-4 w-4" />
                <span>{isSubmitting ? 'Verifying Password...' : 'Unlock Workspace'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                {hasSecurityPin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setUnlockMode('pin');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Use Security PIN Code</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setUnlockMode('setup_pin');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Set a Quick Security PIN</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {/* MODE 3: SETUP QUICK PIN CODE */}
          {unlockMode === 'setup_pin' && (
            <form onSubmit={handleSaveNewPin} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-200">
                  Set Quick Security PIN Code
                </h3>
                <p className="text-[11px] text-slate-400">
                  Create a 4 to 8 digit numeric PIN for fast unlock without typing your full password every time.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">
                  New PIN Code (4–8 Digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234"
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-center text-sm font-bold tracking-widest text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">
                  Confirm PIN Code
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Re-enter PIN code"
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-center text-sm font-bold tracking-widest text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setUnlockMode(hasSecurityPin ? 'pin' : 'password');
                  }}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newPin || newPin !== confirmPin}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save & Unlock'}
                </button>
              </div>
            </form>
          )}

          {/* Bottom Actions: Sign Out */}
          <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Not {displayName.split(' ')[0]}?
            </span>
            <button
              type="button"
              id="btn-lock-screen-signout"
              onClick={async () => {
                if (window.confirm('Are you sure you want to sign out and switch accounts?')) {
                  await signOut();
                }
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Switch Account / Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-xl space-y-4">
            <h3 className="text-sm font-bold">Password Reset</h3>
            {resetSent ? (
              <div className="space-y-3">
                <p className="text-xs text-emerald-400">
                  Password reset link sent to <strong>{user?.email}</strong>. Please check your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetSent(false);
                  }}
                  className="w-full rounded-xl bg-blue-600 py-2 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  Send a password reset instructions link to <strong>{user?.email}</strong>?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReset}
                    disabled={isSubmitting}
                    className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold hover:bg-blue-700"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
