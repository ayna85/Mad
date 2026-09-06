import React from 'react';
import { HelpCircle, FileSpreadsheet, Cpu, Shield, Database, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const HelpView: React.FC = () => {
  const { t } = useApp();

  const helpTopics = [
    {
      title: 'Spreadsheet Formulas & Automatic Calculations',
      icon: Cpu,
      desc: 'Use formulas such as [Birr A] - [Paid A] or SUM([Column]) to automatically calculate totals, profits, and balances. Columns recalculate in real-time across the entire grid.',
    },
    {
      title: 'Disaster Recovery & Version History',
      icon: Shield,
      desc: 'Every significant edit is tracked with automatic version snapshots. Restore past versions anytime with full audit trails.',
    },
    {
      title: 'Supabase Cloud & Offline PWA Sync',
      icon: Database,
      desc: 'Data synchronizes to your Supabase PostgreSQL database. While offline, changes are safely cached in IndexedDB and uploaded upon reconnecting.',
    },
    {
      title: 'Excel & CSV Data Import / Export',
      icon: FileSpreadsheet,
      desc: 'Import existing spreadsheet files (.xlsx, .xls, .csv) with live structure preview and export data in multiple formats.',
    },
    {
      title: 'Mobile PWA Experience',
      icon: Smartphone,
      desc: 'Install MAD as a standalone Progressive Web App on iOS and Android devices for an app-native spreadsheet experience.',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
          {t.nav_help} & Documentation
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          MAD Miyawa 3A Business Spreadsheet System User Guide
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {helpTopics.map((topic, i) => {
          const Icon = topic.icon;
          return (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{topic.title}</h3>
              </div>
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {topic.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Product & Business Card */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 dark:border-blue-900/50 dark:bg-blue-950/30">
        <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200">
          MAD Business Management Architecture
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Product: <span className="font-bold text-slate-900 dark:text-white">MAD Miyawa 3A</span> • Manager:{' '}
          <span className="font-bold text-slate-900 dark:text-white">Abdii</span>
        </p>
      </div>
    </div>
  );
};
