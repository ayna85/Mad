import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { HomeDashboard } from './components/HomeDashboard';
import { TableViewList } from './components/TableViewList';
import { SpreadsheetView } from './components/SpreadsheetView';
import { RecoveryView } from './components/RecoveryView';
import { TrashView } from './components/TrashView';
import { SettingsView } from './components/SettingsView';
import { HelpView } from './components/HelpView';
import { AuthView } from './components/AuthView';
import { LockScreen } from './components/LockScreen';
import { AccountReauthModal } from './components/AccountReauthModal';
import { AdminDevicesView } from './components/AdminDevicesView';
import { CreateTableModal } from './components/CreateTableModal';
import { ErrorBoundary } from './components/ErrorBoundary';

const MainLayout: React.FC = () => {
  const { user, isLocked, isLoading: isAuthLoading, quickLoginAsManager } = useAuth();
  const { activeTable, currentTab } = useApp();
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isAuthLoading) {
      timer = setTimeout(() => setShowSlowWarning(true), 1200);
    } else {
      setShowSlowWarning(false);
    }
    return () => clearTimeout(timer);
  }, [isAuthLoading]);

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white p-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 font-black text-white shadow-lg animate-pulse">
            MAD
          </div>
          <p className="text-xs font-semibold text-slate-400">Loading MAD Miyawa 3A Workspace...</p>
          {showSlowWarning && (
            <button
              type="button"
              onClick={() => quickLoginAsManager()}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition"
            >
              <span>⚡ Enter Workspace Directly</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Not logged in -> Show real Auth screen
  if (!user) {
    return <AuthView />;
  }

  return (
    <>
      {/* 2-Minute Inactivity / Background Re-Auth Full Screen Modal */}
      <AccountReauthModal />

      {/* Session Security Lock Overlay */}
      {isLocked && <LockScreen />}

      {/* Create Table / Spreadsheet Modal */}
      <CreateTableModal />

      {/* If a table is active, open the full-screen spreadsheet view */}
      {activeTable ? (
        <SpreadsheetView />
      ) : (
        /* Otherwise render the main dashboard with navigation */
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F8FAFC] font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-100">
          <Navbar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 dark:bg-slate-950">
              {currentTab === 'home' && <HomeDashboard />}
              {currentTab === 'all_tables' && <TableViewList mode="all" />}
              {currentTab === 'recent' && <TableViewList mode="recent" />}
              {currentTab === 'favorites' && <TableViewList mode="favorites" />}
              {currentTab === 'admin_devices' && <AdminDevicesView />}
              {currentTab === 'recovery' && <RecoveryView />}
              {currentTab === 'trash' && <TrashView />}
              {currentTab === 'backups' && <RecoveryView />}
              {currentTab === 'settings' && <SettingsView />}
              {currentTab === 'account' && <SettingsView />}
              {currentTab === 'help' && <HelpView />}
            </main>
          </div>

          {/* Geometric Balance System Footer */}
          <footer className="flex h-8 shrink-0 items-center justify-between border-t border-slate-200 bg-slate-100 px-4 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <div>MAD Miyawa 3A | System Version: 1.0.4-stable</div>
            <div className="flex items-center gap-4">
              <span>Language: English</span>
              <span>Region: Ethiopia (ET)</span>
              <span className="hidden sm:inline">Manager: Abdii</span>
            </div>
          </footer>
        </div>
      )}
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <MainLayout />
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
