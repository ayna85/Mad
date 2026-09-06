import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Shield,
  ShieldAlert,
  Trash2,
  X,
  CheckCircle2,
  Radio,
  Clock,
  MapPin,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DeviceSession } from '../types';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({ isOpen, onClose }) => {
  const { activeSessions, terminateSession, terminateAllOtherSessions, user, profile } = useAuth();
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTerminate = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate/revoke access for this browser/device?')) return;
    setTerminatingId(sessionId);
    try {
      await terminateSession(sessionId);
      setSuccessMessage('Device session successfully revoked.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setTerminatingId(null);
    }
  };

  const handleTerminateAllOthers = async () => {
    if (!confirm('Are you sure you want to sign out and revoke all other browsers and phones?')) return;
    setTerminatingId('all');
    try {
      await terminateAllOtherSessions();
      setSuccessMessage('All remote sessions have been terminated.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setTerminatingId(null);
    }
  };

  const getDeviceIcon = (type: 'phone' | 'tablet' | 'computer') => {
    if (type === 'phone') return Smartphone;
    if (type === 'tablet') return Tablet;
    return Laptop;
  };

  return (
    <div
      id="device-manager-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="device-manager-modal-card"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Admin: Active Devices & Browsers
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage all phones, browsers, and computers logged into your account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Logged-in Sessions ({activeSessions.length})
            </div>
            {activeSessions.length > 1 && (
              <button
                type="button"
                onClick={handleTerminateAllOthers}
                disabled={terminatingId === 'all'}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Terminate All Other Devices</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {activeSessions.map((session, idx) => {
              const DeviceIcon = getDeviceIcon(session.device_type);
              return (
                <div
                  key={session.id ? `dev-mgr-${session.id}` : `dev-mgr-${idx}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 transition-colors ${
                    session.is_current_device
                      ? 'border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        session.is_current_device
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <DeviceIcon className="h-5 w-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {session.browser_name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          • {session.device_name}
                        </span>
                        {session.is_current_device && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            This Device (Active Now)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {session.os_name}
                        </span>
                        {session.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </span>
                        )}
                        {session.ip_address && (
                          <span className="font-mono text-[10px]">
                            IP: {session.ip_address}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active: {new Date(session.last_active_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {session.is_current_device ? (
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        Current Session
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTerminate(session.id)}
                        disabled={terminatingId === session.id}
                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 hover:text-red-700 active:scale-95 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{terminatingId === session.id ? 'Revoking...' : 'Terminate'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] text-slate-500">
            Account: <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.email}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
