import React, { useState } from 'react';
import {
  Menu,
  Search,
  Globe,
  RefreshCw,
  Wifi,
  WifiOff,
  User,
  LogOut,
  Settings,
  Shield,
  History,
  FileSpreadsheet,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { AuditLogModal } from './AuditLogModal';
import { MAD_PRODUCT_IMAGE } from '../assets/productImage';

export const Navbar: React.FC = () => {
  const {
    t,
    language,
    setLanguage,
    isOnline,
    isSyncing,
    lastSynced,
    manualSync,
    refreshAllData,
    syncMessage,
    sidebarOpen,
    setSidebarOpen,
    searchQuery,
    setSearchQuery,
    setCurrentTab,
  } = useApp();

  const { user, profile, signOut, lockScreen } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  return (
    <>
      {/* Toast banner for global sync/refresh */}
      {syncMessage && (
        <div
          id="sync-message-banner"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md transition-all animate-bounce"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{syncMessage}</span>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between bg-[#1E40AF] px-4 shadow-md sm:px-6 dark:bg-[#1E3A8A] text-white">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            id="btn-toggle-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-blue-700/80 focus:outline-none"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            id="brand-logo"
            onClick={() => setCurrentTab('home')}
            className="flex cursor-pointer items-center gap-2.5"
          >
            <div className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-emerald-600 shadow-xs">
              <img
                src={MAD_PRODUCT_IMAGE}
                alt="MAD Logo"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-white leading-none">
                MAD
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-200 leading-tight">
                Miyawa 3A
              </span>
            </div>
          </div>

          {/* Search Bar in Header */}
          <div className="relative hidden md:block ml-2">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tables..."
              className="h-8 w-60 rounded-full border-none bg-blue-800/50 pl-9 pr-3 text-xs text-white placeholder-blue-200/80 focus:ring-2 focus:ring-blue-300 focus:outline-none lg:w-72"
            />
          </div>
        </div>

        {/* Mobile Search Input */}
        <div className="mx-2 flex-1 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-blue-200" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 w-full rounded-full border-none bg-blue-800/50 pl-8 pr-2.5 text-xs text-white placeholder-blue-200/80 focus:ring-2 focus:ring-blue-300 focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Manager Info, Sync, Language, User Avatar */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sync / Refresh Status Badge */}
          <button
            id="btn-sync-status"
            onClick={refreshAllData}
            title={`Click to Refresh All Data • ${isOnline ? t.online : t.offline} • ${t.last_synced}: ${lastSynced}`}
            className="flex items-center gap-1.5 rounded-full bg-blue-800/50 hover:bg-blue-800/80 px-3 py-1 text-[11px] font-semibold text-blue-100 backdrop-blur-xs transition active:scale-95 cursor-pointer shadow-xs border border-blue-400/20"
          >
            {isOnline ? (
              <Wifi className="h-3 w-3 text-emerald-300" />
            ) : (
              <WifiOff className="h-3 w-3 text-amber-300" />
            )}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            <RefreshCw
              className={`h-3.5 w-3.5 text-emerald-300 ${isSyncing ? 'animate-spin text-white' : ''}`}
            />
            <span className="hidden md:inline text-[10px] text-blue-200">
              {lastSynced}
            </span>
          </button>

          {/* Language Switch */}
          <button
            id="btn-language-toggle"
            onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
            className="flex h-8 items-center gap-1 rounded-lg bg-blue-800/40 px-2 text-xs font-semibold text-white hover:bg-blue-800/70 transition"
            title="Switch Language / ቋንቋ ቀይር"
          >
            <Globe className="h-3.5 w-3.5 text-blue-200" />
            <span>{language === 'en' ? 'አማርኛ' : 'EN'}</span>
          </button>

          {/* Manager & Product Tag */}
          <div className="hidden text-right lg:block">
            <p className="text-xs font-semibold text-blue-100">Manager: Abdii</p>
            <p className="text-[10px] uppercase tracking-widest text-blue-200 opacity-90">Miyawa 3A</p>
          </div>

          {/* Lock Screen Quick Action */}
          <button
            id="btn-navbar-lock"
            type="button"
            onClick={() => lockScreen()}
            title="Lock Workspace Now (Auto-locks after 5 min)"
            className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-800/40 px-2.5 text-xs font-semibold text-white hover:bg-blue-800/80 transition active:scale-95"
          >
            <Lock className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden sm:inline">Lock</span>
          </button>

          {/* User Avatar */}
          <div className="relative">
            <button
              id="btn-user-avatar"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-300 font-bold text-blue-900 ring-2 ring-white/30 transition hover:ring-white"
            >
              {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
            </button>

            {profileMenuOpen && (
              <div
                id="user-dropdown-menu"
                className="absolute right-0 top-10 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                onClick={() => setProfileMenuOpen(false)}
              >
                <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {profile?.full_name || 'Abdii'}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {user?.email || 'abdii@madbusiness.com'}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    <Shield className="h-3 w-3" /> Manager: Abdii • Miyawa 3A
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => setCurrentTab('account')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    {t.nav_account}
                  </button>
                  <button
                    onClick={() => setCurrentTab('settings')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    {t.nav_settings}
                  </button>
                  <button
                    onClick={() => setCurrentTab('all_tables')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                    {t.nav_all_tables}
                  </button>
                  <button
                    onClick={() => setShowAuditLogs(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <History className="h-4 w-4 text-slate-400" />
                    Audit Logs
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
                  <button
                    id="btn-dropdown-lock"
                    onClick={() => lockScreen()}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                  >
                    <Lock className="h-4 w-4" />
                    Lock Workspace
                  </button>
                  <button
                    id="btn-dropdown-logout"
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.nav_logout}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Audit Log Modal */}
      {showAuditLogs && <AuditLogModal onClose={() => setShowAuditLogs(false)} />}
    </>
  );
};
