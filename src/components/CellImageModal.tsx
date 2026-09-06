import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, RotateCcw, Eye, Image as ImageIcon, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../lib/db';

interface CellImageModalProps {
  currentUrl?: string;
  tableId: string;
  rowId: string;
  columnId: string;
  onClose: () => void;
  onSave: (url: string | null) => Promise<void>;
}

export const CellImageModal: React.FC<CellImageModalProps> = ({
  currentUrl,
  tableId,
  rowId,
  columnId,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [previousDeletedUrl, setPreviousDeletedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const { publicUrl } = await dbService.uploadImage(file, user.id, tableId, rowId, columnId);
      setPreviewUrl(publicUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    if (previewUrl) {
      setPreviousDeletedUrl(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleRestore = () => {
    if (previousDeletedUrl) {
      setPreviewUrl(previousDeletedUrl);
      setPreviousDeletedUrl(null);
    }
  };

  const handleSave = async () => {
    await onSave(previewUrl);
    onClose();
  };

  return (
    <div
      id="modal-cell-image"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Manage Image / File Asset
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="py-5">
          {previewUrl ? (
            <div className="space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
                <img
                  src={previewUrl}
                  alt="Cell Asset"
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Replace Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-blue-500 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:border-blue-500 dark:hover:bg-blue-950/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isUploading ? 'Uploading to Supabase Storage...' : 'Click to select or upload an image'}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">PNG, JPG, WEBP, GIF (Max 10MB)</p>
              </div>

              {previousDeletedUrl && (
                <button
                  type="button"
                  onClick={handleRestore}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore Deleted Image</span>
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95"
          >
            <Check className="h-4 w-4" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};
