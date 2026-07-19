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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      {hint && <p className="mb-2 text-sm text-text-muted">{hint}</p>}

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
            className="h-44 w-full rounded-xl border border-border object-cover"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="min-h-12 rounded-xl border border-border-strong px-4 py-3 text-base font-medium text-text-secondary"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="min-h-12 rounded-xl border border-border-strong px-4 py-3 text-base font-medium text-text-secondary"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[7.5rem] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-surface-muted px-4 py-8 text-center transition-colors active:border-primary hover:border-primary/40 hover:bg-primary-soft/50"
        >
          <span className="text-base font-semibold text-text-primary">
            Take or upload photo
          </span>
          <span className="mt-1 text-sm text-text-muted">
            Opens camera on your phone
          </span>
        </button>
      )}
    </div>
  );
}
