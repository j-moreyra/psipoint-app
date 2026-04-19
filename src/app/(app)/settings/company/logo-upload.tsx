"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db/errors";
import { storageErrorMessage } from "@/lib/storage/errors";
import {
  BUCKET_COMPANY_LOGOS,
  isLogoExtension,
  LOGO_CONTENT_TYPES,
  logoPath,
  type LogoExtension,
} from "@/lib/storage/paths";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

type LogoUploadProps = {
  companyId: string;
  initialLogoUrl: string | null; // storage path, e.g. "<uuid>/logo.png"
  initialPreviewUrl: string | null; // signed URL from the server
};

export function LogoUpload({
  companyId,
  initialLogoUrl,
  initialPreviewUrl,
}: LogoUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialPreviewUrl,
  );
  const [storedPath, setStoredPath] = useState<string | null>(initialLogoUrl);

  function getExt(fileName: string, mime: string): LogoExtension | null {
    const dot = fileName.lastIndexOf(".");
    const fromName = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
    if (isLogoExtension(fromName)) return fromName;
    // Fall back to mime — allowlist jpeg shows up as "image/jpeg"; map
    // back to "jpg" for the path convention.
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return null;
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("Logo must be under 2 MB.");
      resetInput();
      return;
    }

    const ext = getExt(file.name, file.type);
    if (!ext) {
      toast.error("Use a PNG, JPG, or WebP file.");
      resetInput();
      return;
    }

    setBusy("upload");
    const supabase = createClient();
    const nextPath = logoPath(companyId, ext);

    try {
      // If the new extension differs from the stored one, the old file
      // at the previous path is orphaned — delete it before uploading
      // the new one so we don't accumulate stale logos.
      if (storedPath && storedPath !== nextPath) {
        await supabase.storage
          .from(BUCKET_COMPANY_LOGOS)
          .remove([storedPath]);
      }

      const { error: upErr } = await supabase.storage
        .from(BUCKET_COMPANY_LOGOS)
        .upload(nextPath, file, {
          contentType: LOGO_CONTENT_TYPES[ext],
          upsert: true,
        });
      if (upErr) {
        toast.error(storageErrorMessage(upErr, "Couldn't upload logo."));
        return;
      }

      const { error: updErr } = await supabase
        .from("companies")
        .update({ logo_url: nextPath })
        .eq("id", companyId);
      if (updErr) {
        toast.error(dbErrorMessage(updErr, "Couldn't save logo."));
        return;
      }

      // Local preview: derive an object URL from the file so the user
      // sees their new logo immediately without a round-trip for a
      // signed URL. The signed URL regenerates on next page load.
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
      setStoredPath(nextPath);
      toast.success("Logo updated.");
      router.refresh();
    } finally {
      setBusy(null);
      resetInput();
    }
  }

  async function onRemove() {
    if (!storedPath) return;
    setBusy("remove");
    const supabase = createClient();
    try {
      const { error: rmErr } = await supabase.storage
        .from(BUCKET_COMPANY_LOGOS)
        .remove([storedPath]);
      if (rmErr) {
        toast.error(storageErrorMessage(rmErr, "Couldn't remove logo."));
        return;
      }
      const { error: updErr } = await supabase
        .from("companies")
        .update({ logo_url: null })
        .eq("id", companyId);
      if (updErr) {
        toast.error(dbErrorMessage(updErr, "Couldn't save change."));
        return;
      }
      setPreviewUrl(null);
      setStoredPath(null);
      toast.success("Logo removed.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function resetInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Company logo</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Appears on the certificate PDF. PNG, JPG, or WebP. Max 2 MB.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
            {previewUrl ? (
              // Using next/image's `unoptimized` because signed URLs
              // expire — Next's image optimizer would cache a URL that
              // stops working after 5 minutes.
              <Image
                src={previewUrl}
                alt="Company logo"
                width={112}
                height={64}
                unoptimized
                className="max-h-14 max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={onFileChosen}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => inputRef.current?.click()}
            >
              {busy === "upload"
                ? "Uploading…"
                : storedPath
                  ? "Replace"
                  : "Upload logo"}
            </Button>
            {storedPath ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={onRemove}
              >
                {busy === "remove" ? "Removing…" : "Remove"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
