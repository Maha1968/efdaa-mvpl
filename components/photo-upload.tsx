"use client";

import { useRef } from "react";

type PhotoUploadProps = {
  id: string;
  label: string;
  hint?: string;
  value: File | null;
  onChange: (file: File | null) => void;
};

export function PhotoUpload({
  id,
  label,
  hint,
  value,
  onChange,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = value ? URL.createObjectURL(value) : null;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-zinc-500">{hint}</p>}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {previewUrl ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`${label} preview`}
            className="h-40 w-full rounded-xl border border-zinc-200 object-cover"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/50"
        >
          <span className="text-2xl">📷</span>
          <span className="mt-2 text-sm font-medium text-zinc-700">
            Tap to take or upload a photo
          </span>
        </button>
      )}
    </div>
  );
}
