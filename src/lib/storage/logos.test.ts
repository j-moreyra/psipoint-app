import { describe, expect, it } from "vitest";
import type { DbClient } from "@/lib/db/client";
import {
  LOGO_PREVIEW_URL_SECONDS,
  createLogoPreviewUrl,
  deleteCompanyLogo,
  fetchCompanyLogoDataUrl,
  uploadCompanyLogo,
} from "./logos";

// Minimal mock for supabase.storage chain. The logos helpers hit
// .upload, .download, .remove, and .createSignedUrl — each method
// returns the canned response and records what it was called with.

type UploadOpts = { contentType?: string; upsert?: boolean };
type UploadResp = { data: unknown; error: { message: string } | null };
type DownloadResp = { data: Blob | null; error: { message: string } | null };
type RemoveResp = { data: unknown; error: { message: string } | null };
type SignedResp = {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
};

type Capture = {
  buckets: string[];
  uploads: Array<{ path: string; opts: UploadOpts }>;
  downloads: string[];
  removes: string[][];
  signedUrls: Array<{ path: string; expiresIn: number }>;
};

function mockDb(resp: {
  upload?: UploadResp;
  download?: DownloadResp;
  remove?: RemoveResp;
  signedUrl?: SignedResp;
}): { db: DbClient; cap: Capture } {
  const cap: Capture = {
    buckets: [],
    uploads: [],
    downloads: [],
    removes: [],
    signedUrls: [],
  };
  const storage = {
    from: (bucket: string) => {
      cap.buckets.push(bucket);
      return {
        upload: (
          path: string,
          _body: Buffer | Blob,
          opts: UploadOpts,
        ) => {
          cap.uploads.push({ path, opts });
          return Promise.resolve(
            resp.upload ?? { data: { path }, error: null },
          );
        },
        download: (path: string) => {
          cap.downloads.push(path);
          return Promise.resolve(
            resp.download ?? {
              data: makeBlob(Buffer.from("logo-bytes")),
              error: null,
            },
          );
        },
        remove: (paths: string[]) => {
          cap.removes.push(paths);
          return Promise.resolve(resp.remove ?? { data: {}, error: null });
        },
        createSignedUrl: (path: string, expiresIn: number) => {
          cap.signedUrls.push({ path, expiresIn });
          return Promise.resolve(
            resp.signedUrl ?? {
              data: { signedUrl: `https://signed.example/${path}` },
              error: null,
            },
          );
        },
      };
    },
  };
  const db = { storage } as unknown as DbClient;
  return { db, cap };
}

function makeBlob(buf: Buffer): Blob {
  // Supabase's storage .download() returns a Web Blob-like object. The
  // helper only calls .arrayBuffer(), so that's all we stub.
  return {
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as Blob;
}

const COMPANY_ID = "11111111-2222-3333-4444-555555555555";

describe("LOGO_PREVIEW_URL_SECONDS", () => {
  it("defaults to 5 minutes (longer than cert TTL; settings page re-renders)", () => {
    expect(LOGO_PREVIEW_URL_SECONDS).toBe(300);
  });
});

describe("uploadCompanyLogo", () => {
  it("uploads a PNG to <company>/logo.png with image/png content type", async () => {
    const { db, cap } = mockDb({});
    const r = await uploadCompanyLogo(db, COMPANY_ID, "png", Buffer.from("x"));
    expect(r.path).toBe(`${COMPANY_ID}/logo.png`);
    expect(cap.buckets).toEqual(["company-logos"]);
    expect(cap.uploads[0].opts.contentType).toBe("image/png");
  });

  it("uploads a JPG with image/jpeg content type", async () => {
    const { db, cap } = mockDb({});
    await uploadCompanyLogo(db, COMPANY_ID, "jpg", Buffer.from("x"));
    expect(cap.uploads[0].path).toBe(`${COMPANY_ID}/logo.jpg`);
    expect(cap.uploads[0].opts.contentType).toBe("image/jpeg");
  });

  it("uploads JPEG with image/jpeg (same mime)", async () => {
    const { db, cap } = mockDb({});
    await uploadCompanyLogo(db, COMPANY_ID, "jpeg", Buffer.from("x"));
    expect(cap.uploads[0].path).toBe(`${COMPANY_ID}/logo.jpeg`);
    expect(cap.uploads[0].opts.contentType).toBe("image/jpeg");
  });

  it("uploads a WebP with image/webp content type", async () => {
    const { db, cap } = mockDb({});
    await uploadCompanyLogo(db, COMPANY_ID, "webp", Buffer.from("x"));
    expect(cap.uploads[0].opts.contentType).toBe("image/webp");
  });

  it("uses upsert=true so reuploading overwrites in place", async () => {
    const { db, cap } = mockDb({});
    await uploadCompanyLogo(db, COMPANY_ID, "png", Buffer.from("x"));
    expect(cap.uploads[0].opts.upsert).toBe(true);
  });

  it("throws on storage error", async () => {
    const { db } = mockDb({
      upload: { data: null, error: { message: "boom" } },
    });
    await expect(
      uploadCompanyLogo(db, COMPANY_ID, "png", Buffer.from("x")),
    ).rejects.toBeTruthy();
  });

  it("throws before calling storage when companyId is not a UUID", async () => {
    const { db, cap } = mockDb({});
    await expect(
      uploadCompanyLogo(db, "not-a-uuid", "png", Buffer.from("x")),
    ).rejects.toThrow(/bad companyId/);
    expect(cap.uploads).toHaveLength(0);
  });
});

describe("fetchCompanyLogoDataUrl", () => {
  it("returns a data URL with the PNG mime type", async () => {
    const { db, cap } = mockDb({
      download: {
        data: makeBlob(Buffer.from([0x89, 0x50, 0x4e])), // PNG magic prefix, not the full file
        error: null,
      },
    });
    const r = await fetchCompanyLogoDataUrl(db, `${COMPANY_ID}/logo.png`);
    expect(r).toBe(
      `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e]).toString("base64")}`,
    );
    expect(cap.buckets).toEqual(["company-logos"]);
    expect(cap.downloads).toEqual([`${COMPANY_ID}/logo.png`]);
  });

  it("uses image/jpeg mime for a .jpg path", async () => {
    const { db } = mockDb({
      download: { data: makeBlob(Buffer.from("fake")), error: null },
    });
    const r = await fetchCompanyLogoDataUrl(db, `${COMPANY_ID}/logo.jpg`);
    expect(r?.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("uses image/webp mime for a .webp path", async () => {
    const { db } = mockDb({
      download: { data: makeBlob(Buffer.from("fake")), error: null },
    });
    const r = await fetchCompanyLogoDataUrl(db, `${COMPANY_ID}/logo.webp`);
    expect(r?.startsWith("data:image/webp;base64,")).toBe(true);
  });

  it("returns null when the stored path has an unsupported extension (e.g. svg)", async () => {
    // Don't attempt the download if we can't reliably set the data-URL
    // mime type — prevents rendering a bogus PDF with a garbage image.
    const { db, cap } = mockDb({});
    const r = await fetchCompanyLogoDataUrl(db, `${COMPANY_ID}/logo.svg`);
    expect(r).toBeNull();
    expect(cap.downloads).toEqual([]);
  });

  it("returns null when the path doesn't match /logo.<ext>", async () => {
    const { db, cap } = mockDb({});
    const r = await fetchCompanyLogoDataUrl(db, "garbage");
    expect(r).toBeNull();
    expect(cap.downloads).toEqual([]);
  });

  it("returns null (doesn't throw) when the storage download errors", async () => {
    const { db } = mockDb({
      download: { data: null, error: { message: "not found" } },
    });
    const r = await fetchCompanyLogoDataUrl(db, `${COMPANY_ID}/logo.png`);
    expect(r).toBeNull();
  });

  it("returns null when storage returns no data and no error", async () => {
    const { db } = mockDb({
      download: { data: null, error: null },
    });
    const r = await fetchCompanyLogoDataUrl(db, `${COMPANY_ID}/logo.png`);
    expect(r).toBeNull();
  });
});

describe("createLogoPreviewUrl", () => {
  it("signs the given path on the company-logos bucket", async () => {
    const { db, cap } = mockDb({
      signedUrl: {
        data: { signedUrl: "https://signed.example/logo" },
        error: null,
      },
    });
    const r = await createLogoPreviewUrl(db, `${COMPANY_ID}/logo.png`);
    expect(r).toBe("https://signed.example/logo");
    expect(cap.buckets).toEqual(["company-logos"]);
    expect(cap.signedUrls[0].path).toBe(`${COMPANY_ID}/logo.png`);
  });

  it("defaults expiry to 300s (LOGO_PREVIEW_URL_SECONDS)", async () => {
    const { db, cap } = mockDb({});
    await createLogoPreviewUrl(db, `${COMPANY_ID}/logo.png`);
    expect(cap.signedUrls[0].expiresIn).toBe(LOGO_PREVIEW_URL_SECONDS);
  });

  it("forwards a custom expiry", async () => {
    const { db, cap } = mockDb({});
    await createLogoPreviewUrl(db, `${COMPANY_ID}/logo.png`, 30);
    expect(cap.signedUrls[0].expiresIn).toBe(30);
  });

  it("returns null (doesn't throw) when the SDK errors — preview is non-critical", async () => {
    const { db } = mockDb({
      signedUrl: { data: null, error: { message: "not found" } },
    });
    const r = await createLogoPreviewUrl(db, `${COMPANY_ID}/logo.png`);
    expect(r).toBeNull();
  });
});

describe("deleteCompanyLogo", () => {
  it("removes the given path from the company-logos bucket", async () => {
    const { db, cap } = mockDb({});
    await deleteCompanyLogo(db, `${COMPANY_ID}/logo.png`);
    expect(cap.buckets).toEqual(["company-logos"]);
    expect(cap.removes).toEqual([[`${COMPANY_ID}/logo.png`]]);
  });

  it("throws when the SDK reports an error", async () => {
    const { db } = mockDb({
      remove: { data: null, error: { message: "permission denied" } },
    });
    await expect(
      deleteCompanyLogo(db, `${COMPANY_ID}/logo.png`),
    ).rejects.toBeTruthy();
  });
});
