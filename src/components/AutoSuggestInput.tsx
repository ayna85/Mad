import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, ChevronDown, Check, Clock, PenLine } from 'lucide-react';

interface AutoSuggestInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  type?: string;
  badgeLabel?: string;
  showAllOnFocus?: boolean;
  onOpenWritePad?: () => void;
  onSave?: () => void;
}

export const AutoSuggestInput: React.FC<AutoSuggestInputProps> = ({
  id,
  value,
  onChange,
  onSelect,
  onKeyDown,
  onBlur,
  onFocus,
  suggestions = [],
  placeholder = 'Type to auto-suggest...',
  className = '',
  autoFocus = false,
  disabled = false,
  type = 'text',
  badgeLabel,
  showAllOnFocus = true,
  onOpenWritePad,
  onSave,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Clean and deduplicate suggestions
  const uniqueSuggestions = useMemo(() => {
    const set = new Set<string>();
    const list: string[] = [];
    for (const item of suggestions) {
      if (item !== undefined && item !== null) {
        const str = String(item).trim();
        if (str && !set.has(str.toLowerCase())) {
          set.add(str.toLowerCase());
          list.push(str);
        }
      }
    }
    return list;
  }, [suggestions]);

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    const trimmed = String(value || '').trim().toLowerCase();
    if (!trimmed) {
      return showAllOnFocus ? uniqueSuggestions.slice(0, 10) : [];
    }
    const matches = uniqueSuggestions.filter((item) =>
      item.toLowerCase().includes(trimmed)
    );
    // Sort exact prefix matches first
    matches.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(trimmed);
      const bStarts = b.toLowerCase().startsWith(trimmed);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
    return matches.slice(0, 10);
  }, [uniqueSuggestions, value, showAllOnFocus]);

  // Auto scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleItemSelect = (selectedVal: string) => {
    onChange(selectedVal);
    if (onSelect) {
      onSelect(selectedVal);
    }
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
          e.preventDefault();
          handleItemSelect(filteredSuggestions[activeIndex]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (e.key === 'Tab' && activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
        handleItemSelect(filteredSuggestions[activeIndex]);
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleInputFocus = () => {
    if (filteredSuggestions.length > 0) {
      setIsOpen(true);
    }
    if (onFocus) onFocus();
  };

  const handleInputBlur = () => {
    // slight timeout to allow click to trigger
    setTimeout(() => {
      if (onBlur) onBlur();
    }, 150);
  };

  // Helper to highlight matching text
  const renderHighlighted = (text: string, query: string) => {
    if (!query.trim()) return text;
    const q = query.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + q.length);
    const after = text.substring(idx + q.length);

    return (
      <>
        {before}
        <span className="bg-amber-100 font-bold text-blue-800 dark:bg-amber-900/60 dark:text-amber-200 rounded px-0.5">
          {match}
        </span>
        {after}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          id={id}
          ref={inputRef}
          type={type}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={`w-full ${className}`}
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {onSave && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent losing focus before save
                onSave();
              }}
              className="flex items-center gap-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-1.5 py-0.5 text-[10px] font-bold shadow-xs transition cursor-pointer"
              title="Save cell value"
            >
              <Check className="h-3 w-3 stroke-[2.5]" />
              <span>Save</span>
            </button>
          )}
          {onOpenWritePad && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onOpenWritePad();
              }}
              className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Open Row Write Pad / Show Box"
            >
              <PenLine className="h-3.5 w-3.5" />
            </button>
          )}
          {uniqueSuggestions.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setIsOpen(!isOpen);
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              title={`${uniqueSuggestions.length} column auto-suggestions available`}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Auto-suggest Typeahead Dropdown Menu */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full min-w-[200px] overflow-auto rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95"
        >
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/60 mb-1">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Auto-Suggest ({filteredSuggestions.length})
            </span>
            {badgeLabel && <span className="font-mono text-[9px] lowercase opacity-70">{badgeLabel}</span>}
          </div>

          <ul ref={listRef} className="space-y-0.5">
            {filteredSuggestions.map((item, idx) => {
              const isSelected = activeIndex === idx;
              const isExact = String(value || '').trim().toLowerCase() === item.toLowerCase();

              return (
                <li
                  key={`${item}-${idx}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur
                    handleItemSelect(item);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950 dark:text-blue-200'
                      : isExact
                      ? 'bg-slate-50 text-slate-800 dark:bg-slate-800/70 dark:text-slate-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{renderHighlighted(item, value)}</span>
                  </span>
                  {isExact && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                </li>
              );
            })}
          </ul>

          {onOpenWritePad && (
            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onOpenWritePad();
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 px-2 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 transition cursor-pointer"
              >
                <PenLine className="h-3.5 w-3.5" />
                <span>Open Row Write Pad / Show Box</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
