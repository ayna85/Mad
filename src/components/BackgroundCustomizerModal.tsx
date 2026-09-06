import React, { useState, useEffect } from 'react';
import { Palette, Check, Sparkles, X, Sun, Moon, Image as ImageIcon } from 'lucide-react';
import { AppBackgroundTheme } from '../types';

interface BackgroundCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BACKGROUND_THEMES: {
  id: AppBackgroundTheme;
  name: string;
  description: string;
  previewBg: string;
  accentColor: string;
  cssClass: string;
}[] = [
  {
    id: 'modern_slate',
    name: 'Modern Slate (Default)',
    description: 'Clean, balanced enterprise neutral aesthetic',
    previewBg: 'bg-slate-100 dark:bg-slate-900 border-slate-300',
    accentColor: '#2563EB',
    cssClass: 'app-bg-modern-slate',
  },
  {
    id: 'midnight_mesh',
    name: 'Midnight Mesh',
    description: 'Deep royal indigo & slate glowing backdrop',
    previewBg: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/30',
    accentColor: '#6366F1',
    cssClass: 'app-bg-midnight-mesh',
  },
  {
    id: 'royal_azure',
    name: 'Royal Azure',
    description: 'High-contrast sapphire & corporate blue gradient',
    previewBg: 'bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 border-blue-400/40',
    accentColor: '#3B82F6',
    cssClass: 'app-bg-royal-azure',
  },
  {
    id: 'emerald_fintech',
    name: 'Emerald Horizon',
    description: 'Fresh business teal & deep emerald gradient',
    previewBg: 'bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border-emerald-500/30',
    accentColor: '#10B981',
    cssClass: 'app-bg-emerald-fintech',
  },
  {
    id: 'blueprint_graph',
    name: 'Blueprint Graph',
    description: 'Architectural grid pattern with crisp lines',
    previewBg: 'bg-slate-900 border-sky-600/40',
    accentColor: '#0EA5E9',
    cssClass: 'app-bg-blueprint-graph',
  },
  {
    id: 'obsidian_dark',
    name: 'Obsidian Minimal',
    description: 'Pure high-contrast dark theme with hairline borders',
    previewBg: 'bg-neutral-950 border-neutral-800',
    accentColor: '#F8FAFC',
    cssClass: 'app-bg-obsidian-dark',
  },
  {
    id: 'sunset_luxe',
    name: 'Sunset Luxe',
    description: 'Warm amber and subtle rose enterprise styling',
    previewBg: 'bg-gradient-to-br from-slate-900 via-rose-950/40 to-amber-950/30 border-rose-500/30',
    accentColor: '#F43F5E',
    cssClass: 'app-bg-sunset-luxe',
  },
];

export const BackgroundCustomizerModal: React.FC<BackgroundCustomizerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentTheme, setCurrentTheme] = useState<AppBackgroundTheme>(() => {
    return (localStorage.getItem('mad_app_bg_theme') as AppBackgroundTheme) || 'modern_slate';
  });

  if (!isOpen) return null;

  const handleSelectTheme = (themeId: AppBackgroundTheme) => {
    setCurrentTheme(themeId);
    localStorage.setItem('mad_app_bg_theme', themeId);
    document.documentElement.setAttribute('data-app-bg', themeId);
  };

  return (
    <div
      id="bg-customizer-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="bg-customizer-modal-card"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Workspace Background & Theme
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customize homepage, login page, and table canvas wallpaper
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

        {/* Theme List */}
        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Available Background Themes
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BACKGROUND_THEMES.map((theme) => {
              const isSelected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/30 dark:border-blue-500 dark:bg-blue-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-5 w-5 rounded-full border ${theme.previewBg} shadow-xs`}
                        style={{ borderColor: theme.accentColor }}
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {theme.name}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {theme.description}
                  </p>

                  <div className="mt-3 h-8 w-full rounded-xl border border-slate-200/40 dark:border-slate-700/40 p-1 flex items-center justify-between px-2 text-[10px] text-slate-400 font-mono overflow-hidden">
                    <span className="truncate">Sample Preview</span>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] text-slate-500">
            Selected: <span className="font-semibold text-blue-600 dark:text-blue-400">{BACKGROUND_THEMES.find(t => t.id === currentTheme)?.name}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};
