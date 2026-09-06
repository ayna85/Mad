import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  HelpCircle,
  ShieldCheck,
  AlertCircle,
  X,
  Check,
  FolderLock,
  Sparkles,
  Search,
} from 'lucide-react';
import { SpreadsheetTable } from '../types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

interface FolderPasswordModalProps {
  table: SpreadsheetTable;
  mode: 'SET' | 'UNLOCK' | 'LOOKUP';
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const FolderPasswordModal: React.FC<FolderPasswordModalProps> = ({
  table,
  mode: initialMode,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, profile, verifySecurityCodeOrPassword } = useAuth();
  const {
    setTablePassword,
    removeTablePassword,
    verifyAndUnlockTable,
    lookupTableSecurity,
  } = useApp();

  const [currentMode, setCurrentMode] = useState<'SET' | 'UNLOCK' | 'LOOKUP'>(initialMode);

  // Set / Change Password fields
  const [folderName, setFolderName] = useState(table.folder_name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState(table.password_hint || '');
  const [showPassword, setShowPassword] = useState(false);

  // Unlock fields
  const [unlockInput, setUnlockInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState<string | null>(table.password_hint || null);

  // Lookup fields
  const [managerSecret, setManagerSecret] = useState('');
  const [isManagerAuthorized, setIsManagerAuthorized] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  // State feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentMode(initialMode);
    setFolderName(table.folder_name || '');
    setPassword('');
    setConfirmPassword('');
    setPasswordHint(table.password_hint || '');
    setUnlockInput('');
    setShowHint(false);
    setCurrentHint(table.password_hint || null);
    setManagerSecret('');
    setIsManagerAuthorized(false);
    setRevealedPassword(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialMode, table, isOpen]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------

  // 1. Set / Update Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!password) {
      setErrorMessage('Please enter a password or PIN code');
      return;
    }

    if (password.length < 3) {
      setErrorMessage('Password should be at least 3 characters or digits');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await setTablePassword(table.id, password, passwordHint, folderName);
      setSuccessMessage('Folder password protection successfully updated!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to set password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Remove Password Protection
  const handleRemoveProtection = async () => {
    if (!confirm('Are you sure you want to remove password protection from this table/folder?')) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await removeTablePassword(table.id);
      setSuccessMessage('Password protection removed');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Unlock Folder / Table
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!unlockInput) {
      setErrorMessage('Please enter the password to unlock');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyAndUnlockTable(table.id, unlockInput);
      if (res.success) {
        setSuccessMessage('Unlocked successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 500);
      } else {
        setErrorMessage(res.error || 'Incorrect password. Try again or use Password Lookup.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Password Lookup via Manager Authorization
  const handleLookupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!managerSecret.trim()) {
      setErrorMessage('Please enter your account password or Manager PIN to authenticate');
      return;
    }

    setIsSubmitting(true);
    try {
      const authRes = await verifySecurityCodeOrPassword(managerSecret.trim());
      if (!authRes.success) {
        setErrorMessage('Manager verification failed: ' + (authRes.error || 'Invalid credentials'));
        setIsSubmitting(false);
        return;
      }

      // Authorized -> Fetch security lookup details
      const lookup = await lookupTableSecurity(table.id);
      setIsManagerAuthorized(true);
      setCurrentHint(lookup.passwordHint || 'No hint set');
      setRevealedPassword(lookup.decodedPassword || 'Protected by encrypted hash');
      setSuccessMessage('Manager identity verified. Password details retrieved below.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Lookup error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="folder-password-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div
        id="folder-password-modal-card"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shadow-2xs">
            {currentMode === 'UNLOCK' ? (
              <Lock className="h-6 w-6 text-amber-500" />
            ) : currentMode === 'LOOKUP' ? (
              <Search className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <FolderLock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {currentMode === 'UNLOCK'
                ? 'Unlock Password-Protected Table'
                : currentMode === 'LOOKUP'
                ? 'Folder Password Lookup & Recovery'
                : 'Set Folder / Table Password'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
              Table: <span className="font-semibold text-slate-700 dark:text-slate-200">{table.name}</span>
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs for Owner */}
        {currentMode !== 'UNLOCK' && (
          <div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-semibold">
            <button
              onClick={() => {
                setCurrentMode('SET');
                setErrorMessage(null);
              }}
              className={`flex-1 rounded-lg py-1.5 transition ${
                currentMode === 'SET'
                  ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Set / Update Password
            </button>
            <button
              onClick={() => {
                setCurrentMode('LOOKUP');
                setErrorMessage(null);
              }}
              className={`flex-1 rounded-lg py-1.5 transition ${
                currentMode === 'LOOKUP'
                  ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Password Lookup
            </button>
          </div>
        )}

        {/* Alert Messages */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* 1. UNLOCK MODE */}
        {/* -------------------------------------------------------- */}
        {currentMode === 'UNLOCK' && (
          <form onSubmit={handleUnlock} className="mt-4 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              This spreadsheet is locked with a security password. Enter the password or PIN to open and view the data.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Enter Password or PIN
              </label>
              <div className="relative mt-1">
                <input
                  id="input-unlock-password"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  value={unlockInput}
                  onChange={(e) => setUnlockInput(e.target.value)}
                  placeholder="Enter folder password..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Hint Option */}
            {table.password_hint && (
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                    Need a reminder?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {showHint ? 'Hide Hint' : 'Show Password Hint'}
                  </button>
                </div>
                {showHint && (
                  <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-blue-50/50 dark:bg-blue-950/40 p-2 rounded-lg">
                    Hint: {table.password_hint}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('LOOKUP');
                  setErrorMessage(null);
                }}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Password Lookup</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-unlock"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 transition disabled:opacity-50"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Verifying...' : 'Unlock & Open'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* -------------------------------------------------------- */}
        {/* 2. SET / UPDATE PASSWORD MODE */}
        {/* -------------------------------------------------------- */}
        {currentMode === 'SET' && (
          <form onSubmit={handleSavePassword} className="mt-4 space-y-3.5">
            {/* Optional Folder Category / Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Folder / Department Name (Optional)
              </label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g., Finance, Secret Inventories, Executive..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Folder Security Password / PIN
              </label>
              <div className="relative mt-1">
                <input
                  id="input-set-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password or PIN..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 pr-10 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Confirm Password
              </label>
              <input
                id="input-set-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Password Hint */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Password Hint (Optional for quick lookup)
              </label>
              <input
                type="text"
                value={passwordHint}
                onChange={(e) => setPasswordHint(e.target.value)}
                placeholder="e.g. Manager initials + branch number"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              {table.is_password_protected ? (
                <button
                  type="button"
                  onClick={handleRemoveProtection}
                  className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove Password
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-folder-password"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 transition disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Set Protection'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* -------------------------------------------------------- */}
        {/* 3. PASSWORD LOOKUP METHOD (Manager Recovery) */}
        {/* -------------------------------------------------------- */}
        {currentMode === 'LOOKUP' && (
          <div className="mt-4 space-y-4">
            {!isManagerAuthorized ? (
              <form onSubmit={handleLookupPassword} className="space-y-3.5">
                <div className="rounded-xl bg-blue-50/70 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                  <span className="font-bold">Password Lookup Assistant:</span> Authenticate with your Manager Account Password or Security PIN to inspect or recover the password for this folder.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Enter Manager Account Password or Security PIN
                  </label>
                  <input
                    id="input-manager-lookup-secret"
                    type="password"
                    autoFocus
                    value={managerSecret}
                    onChange={(e) => setManagerSecret(e.target.value)}
                    placeholder="Enter account password or 4-6 digit PIN..."
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (table.is_password_protected) setCurrentMode('UNLOCK');
                      else setCurrentMode('SET');
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Back
                  </button>
                  <button
                    id="btn-authenticate-lookup"
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? 'Authenticating...' : 'Look Up Password'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Authorized Lookup Details Display */
              <div className="space-y-3.5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/40">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Manager Access Granted</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-emerald-100 pb-1.5 dark:border-emerald-900">
                      <span className="text-slate-500 dark:text-slate-400">Folder / Table:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{table.name}</span>
                    </div>

                    <div className="flex justify-between border-b border-emerald-100 pb-1.5 dark:border-emerald-900">
                      <span className="text-slate-500 dark:text-slate-400">Password Hint:</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {currentHint || 'No hint configured'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500 dark:text-slate-400">Recovered Password:</span>
                      <span className="rounded-md bg-white px-2.5 py-1 font-mono text-xs font-extrabold text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300">
                        {revealedPassword || 'Encrypted'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentMode('SET');
                      setPassword('');
                      setConfirmPassword('');
                    }}
                    className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Change / Reset Password
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (revealedPassword) {
                        const res = await verifyAndUnlockTable(table.id, revealedPassword);
                        if (res.success) {
                          if (onSuccess) onSuccess();
                          onClose();
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 transition"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Unlock & Open Now</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
