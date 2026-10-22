"use client";

import { useEffect, useState } from "react";

const MAX_SIDE = 1600;

// Зургийг илгээхээс өмнө утсан дээрээ шахна (мобайл дата хэмнэнэ)
async function compress(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

type Props = { name: string; label: string; hint?: string; required?: boolean };

export function PhotoInput({ name, label, hint, required }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  return (
    <label className="photo-pick">
      <span className="ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="" /> : "📷"}
      </span>
      <span>
        <b>{label}</b>
        {hint && <span className="hint" style={{ display: "block" }}>{hint}</span>}
      </span>
      <input
        type="file"
        name={name}
        accept="image/*"
        capture="environment"
        required={required}
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          if (!file) return setPreview(null);
          try {
            const small = await compress(file);
            const dt = new DataTransfer();
            dt.items.add(small);
            input.files = dt.files;
            setPreview(URL.createObjectURL(small));
          } catch {
            // шахаж чадахгүй бол эх файлаараа илгээнэ
            setPreview(URL.createObjectURL(file));
          }
        }}
      />
    </label>
  );
}
