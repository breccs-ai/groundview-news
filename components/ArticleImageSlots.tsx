'use client';

import { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';

type Props = {
  files: Array<File | null>;
  urls: Array<string | null>;
  disabled?: boolean;
  onFileChange: (index: number, file: File | null) => void;
  onClear: (index: number) => void;
};

export default function ArticleImageSlots({
  files,
  urls,
  disabled = false,
  onFileChange,
  onClear,
}: Props) {
  const [localPreviews, setLocalPreviews] = useState<Array<string | null>>([
    null,
    null,
    null,
  ]);

  useEffect(() => {
    const next = files.slice(0, 3).map((file) => (file ? URL.createObjectURL(file) : null));
    while (next.length < 3) next.push(null);
    setLocalPreviews(next);

    return () => {
      next.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [files]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[0, 1, 2].map((index) => {
        const previewUrl = localPreviews[index] || urls[index] || null;
        return (
          <div key={index} className="rounded-sm border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-700">Image {index + 1}</span>
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => onClear(index)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                  aria-label={`Clear image ${index + 1}`}
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>

            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Article image ${index + 1} preview`}
                className="mb-3 h-28 w-full rounded-sm bg-gray-100 object-cover"
              />
            ) : (
              <div className="mb-3 flex h-28 items-center justify-center rounded-sm bg-gray-50 text-xs text-gray-400">
                No image selected
              </div>
            )}

            <label
              className={`inline-flex w-full items-center justify-center gap-2 rounded-sm border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-500 ${
                disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }`}
            >
              <Upload size={13} aria-hidden />
              {previewUrl ? 'Replace image' : 'Choose image'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={disabled}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] || null;
                  event.currentTarget.value = '';
                  onFileChange(index, file);
                }}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}
