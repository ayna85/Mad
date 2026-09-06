import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Shield,
  Trash2,
  CheckCircle2,
  Clock,
  MapPin,
  LogOut,
  RefreshCw,
  Info,
  Activity,
  Folder,
  FileSpreadsheet,
  Zap,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';
import { AuditLog } from '../types';
import { formatExactDateTime, formatRelativeTime } from '../lib/dateUtils';

export const AdminDevicesView: React.FC = () => {
  const { activeSessions, terminateSession, terminateAllOtherSessions, user } = useAuth();
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await dbService.getAuditLogs(user?.id || '');
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Failed to fetch audit logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user?.id]);

  const handleTerminate = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke and sign out this session?')) return;
    setTerminatingId(sessionId);
    try {
      await terminateSession(sessionId);
      setMessage('Session successfully terminated.');
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setTerminatingId(null);
    }
  };

  const handleTerminateAll = async () => {
    if (!confirm('Are you sure you want to terminate all remote phone and browser sessions?')) return;
    setTerminatingId('all');
    try {
      await terminateAllOtherSessions();
      setMessage('All other sessions terminated.');
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setTerminatingId(null);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (logFilter === 'all') return true;
    if (logFilter === 'folders') return log.action?.includes('FOLDER') || Boolean(log.folder_name);
    if (logFilter === 'cells') return log.action?.includes('CELL') || log.change_method?.includes('Cell');
    if (logFilter === 'rows') return log.action?.includes('ROW') || log.change_method?.includes('WritePad');
    if (logFilter === 'phones') return log.device_type === 'phone';
    if (logFilter === 'opera') return log.browser_name?.toLowerCase().includes('opera');
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Admin Device & Browser Manager
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Real-time multi-sync audit: Track every computer, tablet, Opera browser, and mobile phone logged into your account
          </p>
        </div>
        {activeSessions.length > 1 && (
          <button
            type="button"
            onClick={handleTerminateAll}
            disabled={terminatingId === 'all'}
            className="flex items-center gap-2 self-start rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 shadow-xs hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out All Other Devices</span>
          </button>
        )}
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <Shield className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
          <p className="font-bold">Continuous Hardware & Browser Recognition</p>
          <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
            The Miyawa 3A Sentinel automatically registers browser signatures (such as Opera Mobile, Chrome, Safari, Edge) and device identifiers. You can immediately disconnect any unwanted phone or browser with 1 click.
          </p>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span>Connected Devices ({activeSessions.length})</span>
          <span>Status</span>
        </div>

        {activeSessions.map((session, idx) => {
          const isPhone = session.device_type === 'phone';
          const isTablet = session.device_type === 'tablet';
          const Icon = isPhone ? Smartphone : isTablet ? Tablet : Laptop;

          return (
            <div
              key={session.id ? `dev-session-${session.id}` : `dev-session-${idx}`}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 transition ${
                session.is_current_device
                  ? 'border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    session.is_current_device
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {session.browser_name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      • {session.device_name}
                    </span>
                    {session.is_current_device ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Current Device (Active Now)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Remote Session
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      {session.os_name}
                    </span>
                    {session.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.location}
                      </span>
                    )}
                    {session.ip_address && (
                      <span className="font-mono text-[11px]">
                        IP: {session.ip_address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Last sync: {new Date(session.last_active_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="self-end sm:self-center">
                {session.is_current_device ? (
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    This Browser
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTerminate(session.id)}
                    disabled={terminatingId === session.id}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-100 hover:text-red-700 active:scale-95 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{terminatingId === session.id ? 'Revoking...' : 'Terminate Device'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-Time Device & Browser Data Change History Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Multi-Device & Browser Data Change History
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Tracks which browser, phone, or computer made changes, folders affected, change method, and exact timestamps
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={isLoadingLogs}
              title="Refresh change logs"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLogs ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mr-1">
            <Filter className="h-3 w-3" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Changes' },
            { id: 'folders', label: '📁 Folder Changes' },
            { id: 'rows', label: '✍️ Row WritePad' },
            { id: 'cells', label: '⚡ Direct Cell Edits' },
            { id: 'phones', label: '📱 Mobile Phones' },
            { id: 'opera', label: '🔴 Opera Browser' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setLogFilter(f.id)}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                logFilter === f.id
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Log Entries List */}
        {filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
            No modification logs found matching filter.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredLogs.map((log) => {
              const isPhone = log.device_type === 'phone';
              const isTablet = log.device_type === 'tablet';
              const DevIcon = isPhone ? Smartphone : isTablet ? Tablet : Laptop;

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs transition hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:border-slate-700"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 mt-0.5">
                      <DevIcon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {log.device_name || 'Device'}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          ({log.browser_name || 'Browser'})
                        </span>
                        {log.change_method && (
                          <span className="rounded-full bg-slate-200/80 px-2 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            ⚡ {log.change_method}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                        {log.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                        {log.folder_name && (
                          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <Folder className="h-3 w-3" /> {log.folder_name}
                          </span>
                        )}
                        {log.table_name && (
                          <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                            <FileSpreadsheet className="h-3 w-3" /> {log.table_name}
                          </span>
                        )}
                        <span>OS: {log.os_name || 'Universal'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 justify-end">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>{formatExactDateTime(log.created_at)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

