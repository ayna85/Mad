import React, { useState } from 'react';
import {
  X,
  Sliders,
  Type,
  Hash,
  DollarSign,
  Calendar,
  CheckSquare,
  List,
  Cpu,
  Image as ImageIcon,
  Minus,
  Plus,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  Sparkles,
  Globe,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TableColumn, ColumnType, NumberFormatType, DateFormatType } from '../types';
import { getTodayEthiopian } from '../lib/ethiopianCalendar';
import { getColumnLetter } from '../lib/formulaEngine';

interface ColumnPropertiesModalProps {
  column: TableColumn;
  allColumns: TableColumn[];
  onClose: () => void;
  onSave: (updates: Partial<TableColumn>) => Promise<void>;
  onDelete: () => Promise<void>;
  onInsertLeft?: () => Promise<void>;
  onInsertRight?: () => Promise<void>;
}

export const ColumnPropertiesModal: React.FC<ColumnPropertiesModalProps> = ({
  column,
  allColumns,
  onClose,
  onSave,
  onDelete,
  onInsertLeft,
  onInsertRight,
}) => {
  const { t } = useApp();

  const [name, setName] = useState(column.name);
  const [type, setType] = useState<ColumnType>(column.type);
  const [width, setWidth] = useState(column.width || 160);
  const [formula, setFormula] = useState(column.formula || '');
  const [numberFormat, setNumberFormat] = useState<NumberFormatType>(
    column.formatting?.numberFormat || (column.type === 'amount' ? 'currency_etb' : 'normal')
  );
  const [customDecimals, setCustomDecimals] = useState<number>(column.formatting?.decimals ?? 2);
  const [currencySymbol, setCurrencySymbol] = useState<string>(column.formatting?.currencySymbol || 'ETB');
  const [calendarSystem, setCalendarSystem] = useState<'ethiopian' | 'gregorian'>(
    column.formatting?.calendarSystem || 'ethiopian'
  );
  const [dateFormat, setDateFormat] = useState<DateFormatType>(
    column.formatting?.dateFormat || 'ethiopian_dd_mm_yyyy'
  );
  const [selectOptionsStr, setSelectOptionsStr] = useState(
    column.formatting?.selectOptions?.join(', ') || 'Paid, Pending, Verified, Overdue'
  );

  // Style state
  const [bold, setBold] = useState(Boolean(column.styling?.bold));
  const [italic, setItalic] = useState(Boolean(column.styling?.italic));
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(column.styling?.align || 'left');
  const [bgColor, setBgColor] = useState(column.styling?.bgColor || '');
  const [textColor, setTextColor] = useState(column.styling?.textColor || '');

  const [isSaving, setIsSaving] = useState(false);

  const columnTypes: { type: ColumnType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { type: 'text', label: 'Text', icon: Type },
    { type: 'number', label: 'Number', icon: Hash },
    { type: 'amount', label: 'Amount', icon: DollarSign },
    { type: 'date', label: 'Date', icon: Calendar },
    { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { type: 'select', label: 'Select', icon: List },
    { type: 'formula', label: 'Formula', icon: Cpu },
    { type: 'image', label: 'Image', icon: ImageIcon },
  ];

  const numberFormats: { format: NumberFormatType; label: string }[] = [
    { format: 'normal', label: 'Normal' },
    { format: 'comma', label: 'Comma separator (1,000)' },
    { format: '0_decimal', label: '0 decimals (1000)' },
    { format: '2_decimal', label: '0.00 (1000.00)' },
    { format: '3_decimal', label: '0.000 (1000.000)' },
    { format: 'custom', label: 'Custom decimals' },
    { format: 'currency_etb', label: 'ETB (Birr)' },
    { format: 'currency_usd', label: 'USD ($)' },
    { format: 'currency_eur', label: 'EUR (€)' },
  ];

  const handleWidthChange = (delta: number) => {
    setWidth((prev) => Math.max(60, Math.min(800, prev + delta)));
  };

  const handleResetStyle = () => {
    setBold(false);
    setItalic(false);
    setAlign('left');
    setBgColor('');
    setTextColor('');
  };

  const insertFormulaToken = (token: string) => {
    setFormula((prev) => (prev ? `${prev.trim()} ${token}` : token));
  };

  const insertFormulaFunction = (fn: string) => {
    if (fn === 'IF') {
      setFormula((prev) => (prev ? `${prev.trim()} IF([Column] > 0, [Value1], [Value2])` : `IF([Column] > 0, [Value1], [Value2])`));
    } else {
      setFormula((prev) => (prev ? `${prev.trim()} ${fn}([ColumnA], [ColumnB])` : `${fn}([ColumnA], [ColumnB])`));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const optionsArray = selectOptionsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await onSave({
        name: name.trim() || column.name,
        type,
        width: Math.max(60, Math.min(800, Number(width) || 160)),
        formula: type === 'formula' ? formula.trim() : undefined,
        formatting: {
          numberFormat,
          dateFormat: type === 'date' ? dateFormat : undefined,
          calendarSystem: type === 'date' ? calendarSystem : undefined,
          decimals: numberFormat === 'custom_decimal' ? customDecimals : undefined,
          currencySymbol: numberFormat.startsWith('currency') ? currencySymbol : undefined,
          selectOptions: type === 'select' ? optionsArray : undefined,
        },
        styling: {
          bold,
          italic,
          align,
          bgColor: bgColor || undefined,
          textColor: textColor || undefined,
        },
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="modal-column-properties"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Column Properties
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{column.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* 1. Column Name */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Column Name
            </label>
            <input
              id="input-column-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Birr Amount"
              className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* 2. Column Type */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Column Type
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {columnTypes.map((ct) => {
                const Icon = ct.icon;
                const isSelected = type === ct.type;
                return (
                  <button
                    key={ct.type}
                    type="button"
                    onClick={() => {
                      setType(ct.type);
                      if (ct.type === 'amount') setNumberFormat('currency_etb');
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{ct.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Column Width: [-] Width slider, Width input, [+], Display: "Width: 160 px" */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Column Width</span>
              </div>
              <span className="rounded-lg bg-blue-100 px-2.5 py-1 font-mono text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Width: {width} px
              </span>
            </div>

            {/* Quick Width Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Presets:</span>
              {[
                { label: 'Compact (100px)', val: 100 },
                { label: 'Normal (160px)', val: 160 },
                { label: 'Wide (220px)', val: 220 },
                { label: 'Extra (300px)', val: 300 },
                { label: 'Large (400px)', val: 400 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setWidth(p.val)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                    width === p.val
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleWidthChange(-20)}
                className="flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Decrease width by 20px"
              >
                -20
              </button>
              <button
                type="button"
                onClick={() => handleWidthChange(-10)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Decrease width by 10px"
              >
                <Minus className="h-4 w-4" />
              </button>

              <input
                type="range"
                min="60"
                max="800"
                step="5"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-700"
              />

              <input
                type="number"
                min="60"
                max="800"
                value={width}
                onChange={(e) => setWidth(Math.max(60, Math.min(800, Number(e.target.value) || 60)))}
                className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2 text-center text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />

              <button
                type="button"
                onClick={() => handleWidthChange(10)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Increase width by 10px"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleWidthChange(20)}
                className="flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Increase width by 20px"
              >
                +20
              </button>
            </div>
          </div>

          {/* 4. Alignment & Style & Colors */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Alignment & Text Styling
              </label>
              <button
                type="button"
                onClick={handleResetStyle}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Style</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Alignment & Bold/Italic */}
              <div className="flex items-center gap-2">
                {/* Alignment buttons */}
                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setAlign('left')}
                    className={`rounded p-2 text-xs font-bold ${
                      align === 'left'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-slate-500'
                    }`}
                    title="Left Align"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlign('center')}
                    className={`rounded p-2 text-xs font-bold ${
                      align === 'center'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-slate-500'
                    }`}
                    title="Center Align"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlign('right')}
                    className={`rounded p-2 text-xs font-bold ${
                      align === 'right'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-slate-500'
                    }`}
                    title="Right Align"
                  >
                    <AlignRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Bold */}
                <button
                  type="button"
                  onClick={() => setBold(!bold)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold ${
                    bold
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </button>

                {/* Italic */}
                <button
                  type="button"
                  onClick={() => setItalic(!italic)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold ${
                    italic
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </button>
              </div>

              {/* Text Color & Background Color with Hex Code Input */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Text Color
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={textColor || '#000000'}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-0.5 dark:border-slate-700"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      placeholder="#000000"
                      className="h-8 w-24 rounded-lg border border-slate-300 bg-white px-2 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Background Color
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={bgColor || '#ffffff'}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-0.5 dark:border-slate-700"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      placeholder="#ffffff"
                      className="h-8 w-24 rounded-lg border border-slate-300 bg-white px-2 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Preset Palette Swatches */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Quick Background Presets
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {[
                    { color: '', label: 'Default' },
                    { color: '#EFF6FF', label: 'Light Blue' },
                    { color: '#F0FDF4', label: 'Light Green' },
                    { color: '#FEF3C7', label: 'Light Amber' },
                    { color: '#FFE4E6', label: 'Light Rose' },
                    { color: '#F3E8FF', label: 'Light Purple' },
                    { color: '#F1F5F9', label: 'Soft Slate' },
                    { color: '#1E293B', label: 'Dark Navy' },
                    { color: '#064E3B', label: 'Dark Forest' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setBgColor(preset.color)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                        bgColor === preset.color
                          ? 'border-blue-600 ring-1 ring-blue-600 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-slate-300 dark:border-slate-600"
                        style={{ backgroundColor: preset.color || '#ffffff' }}
                      />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Insert Column Left / Right actions */}
              {(onInsertLeft || onInsertRight) && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  {onInsertLeft && (
                    <button
                      type="button"
                      onClick={onInsertLeft}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <span>+ Insert Column Left</span>
                    </button>
                  )}
                  {onInsertRight && (
                    <button
                      type="button"
                      onClick={onInsertRight}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <span>+ Insert Column Right</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 5. Formula configuration (if formula type) */}
          {type === 'formula' && (
            <div className="space-y-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <label className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Formula Expression (ቀመር)
                  </label>
                </div>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Supports A-B, [Birr A] - [Paid A], SUM, IF
                </span>
              </div>

              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g. A - B  or  [Birr A] - [Paid A]  or  SUM([A], [B])"
                className="h-10 w-full rounded-xl border border-blue-300 bg-white px-3 font-mono text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-blue-800 dark:bg-slate-950 dark:text-white"
              />

              {/* Quick Formula Templates */}
              <div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Quick Templates:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {[
                    { label: 'A - B (Difference / Balance)', val: 'A - B' },
                    { label: 'A + B (Total Sum)', val: 'A + B' },
                    { label: 'A * B (Multiply Qty & Price)', val: 'A * B' },
                    { label: 'A / B (Ratio / Division)', val: 'A / B' },
                  ].map((tpl) => (
                    <button
                      key={tpl.val}
                      type="button"
                      onClick={() => setFormula(tpl.val)}
                      className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold text-blue-700 shadow-2xs hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Math Operators */}
              <div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Math Operators:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {['+', '-', '*', '/', '(', ')'].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => insertFormulaToken(op)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              {/* Insert Column Letter & Name Pills */}
              <div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  Click Column to Insert:
                </span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {allColumns
                    .filter((c) => c.id !== column.id)
                    .map((c) => {
                      const colIdx = (c.position !== undefined ? c.position : allColumns.indexOf(c));
                      const letter = getColumnLetter(colIdx >= 0 ? colIdx : 0);
                      return (
                        <div key={c.id} className="flex items-center rounded-lg border border-blue-300 bg-white p-0.5 shadow-2xs dark:border-blue-800 dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() => insertFormulaToken(letter)}
                            className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 transition hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300"
                            title={`Insert Column Letter '${letter}'`}
                          >
                            [{letter}]
                          </button>
                          <button
                            type="button"
                            onClick={() => insertFormulaToken(`[${c.name}]`)}
                            className="px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                            title={`Insert Column Name '[${c.name}]'`}
                          >
                            {c.name}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Formula helper functions */}
              <div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Functions:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {['SUM', 'AVERAGE', 'MIN', 'MAX', 'IF', 'COUNT'].map((fn) => (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => insertFormulaFunction(fn)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      +{fn}()
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. Number & Currency Formatting (for number, amount, formula) */}
          {(type === 'number' || type === 'amount' || type === 'formula') && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Number & Currency Formatting
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={numberFormat}
                  onChange={(e) => setNumberFormat(e.target.value as NumberFormatType)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {numberFormats.map((nf) => (
                    <option key={nf.format} value={nf.format}>
                      {nf.label}
                    </option>
                  ))}
                </select>

                {numberFormat === 'custom_decimal' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Decimals:</span>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={customDecimals}
                      onChange={(e) => setCustomDecimals(Number(e.target.value))}
                      className="h-10 w-20 rounded-xl border border-slate-300 bg-white px-3 text-center text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                )}

                {numberFormat.startsWith('currency') && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Symbol:</span>
                    <input
                      type="text"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      placeholder="ETB"
                      className="h-10 w-24 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. Date Column & Ethiopian Calendar Settings (if date type) */}
          {type === 'date' && (
            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-sm dark:bg-emerald-900/60">
                    🇪🇹
                  </span>
                  <div>
                    <label className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      Date & Calendar System
                    </label>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Ethiopian Calendar (የኢትዮጵያ ዘመን አቆጣጠር) & Gregorian Date Formatting
                    </p>
                  </div>
                </div>

                {/* Calendar System Switcher */}
                <div className="flex rounded-xl border border-emerald-300 bg-white p-1 dark:border-emerald-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarSystem('ethiopian');
                      setDateFormat('ethiopian_dd_mm_yyyy');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      calendarSystem === 'ethiopian'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    <span>🇪🇹 Ethiopian</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarSystem('gregorian');
                      setDateFormat('gregorian_iso');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      calendarSystem === 'gregorian'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    <Globe className="h-3 w-3" />
                    <span>Gregorian</span>
                  </button>
                </div>
              </div>

              {/* Date Format Presets */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Display Date Format
                </label>
                {calendarSystem === 'ethiopian' ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      {
                        fmt: 'ethiopian_dd_mm_yyyy' as DateFormatType,
                        label: 'DD/MM/YYYY (Standard E.C.)',
                        example: getTodayEthiopian().formattedSlash, // e.g. "25/12/2018"
                        badge: 'Recommended',
                      },
                      {
                        fmt: 'ethiopian_text' as DateFormatType,
                        label: 'Amharic Month Name',
                        example: getTodayEthiopian().formattedAmharic, // e.g. "25 ነሐሴ 2018"
                      },
                      {
                        fmt: 'ethiopian_iso' as DateFormatType,
                        label: 'YYYY-MM-DD (ISO E.C.)',
                        example: getTodayEthiopian().formattedIso, // e.g. "2018-12-25"
                      },
                    ].map((item) => (
                      <button
                        key={item.fmt}
                        type="button"
                        onClick={() => setDateFormat(item.fmt)}
                        className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                          dateFormat === item.fmt
                            ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-slate-900'
                            : 'border-slate-200 bg-white/70 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950/40'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span className="mt-1 font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {item.example}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      {
                        fmt: 'gregorian_iso' as DateFormatType,
                        label: 'YYYY-MM-DD (ISO)',
                        example: new Date().toISOString().split('T')[0],
                      },
                      {
                        fmt: 'gregorian_slash' as DateFormatType,
                        label: 'DD/MM/YYYY (Standard GC)',
                        example: `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`,
                      },
                      {
                        fmt: 'gregorian_text' as DateFormatType,
                        label: 'Month Day, Year',
                        example: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
                      },
                    ].map((item) => (
                      <button
                        key={item.fmt}
                        type="button"
                        onClick={() => setDateFormat(item.fmt)}
                        className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                          dateFormat === item.fmt
                            ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-slate-900'
                            : 'border-slate-200 bg-white/70 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950/40'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.label}
                        </span>
                        <span className="mt-1 font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                          {item.example}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Ethiopian Calendar Details info card */}
              {calendarSystem === 'ethiopian' && (
                <div className="rounded-xl border border-emerald-200/80 bg-white/80 p-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-slate-900/80 dark:text-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Today in Ethiopian Calendar:</span>
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                      {getTodayEthiopian().formattedAmharic} ({getTodayEthiopian().formattedSlash})
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Supports 13 Ethiopian months (መስከረም, ጥቅምት, ህዳር, ታህሳስ, ጥር, የካቲት, መጋቢት, ሚያዝያ, ግንቦት, ሰኔ, ሐምሌ, ነሐሴ, ጳጉሜ) with automatic conversions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 8. Select Options (if select type) */}
          {type === 'select' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Dropdown Options (comma separated)
              </label>
              <input
                type="text"
                value={selectOptionsStr}
                onChange={(e) => setSelectOptionsStr(e.target.value)}
                placeholder="Paid, Pending, Verified, Overdue"
                className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <button
            id="btn-properties-delete-column"
            type="button"
            onClick={onDelete}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline dark:text-red-400"
          >
            Delete Column
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              id="btn-save-column-properties"
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
            >
              {isSaving ? 'Saving...' : 'Save Properties'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
