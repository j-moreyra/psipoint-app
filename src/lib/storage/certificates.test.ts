import { describe, expect, it } from "vitest";
import type { DbClient } from "@/lib/db/client";
import {
  CERT_SIGNED_URL_SECONDS,
  createCertificateSignedUrl,
  uploadCertificatePdf,
} from "./certificates";

// Mock Supabase storage chain — only the calls used by certificates.ts.
// `from(bucket)` returns an object with `upload` and `createSignedUrl`;
// both receive the args we assert on. Missing calls throw, catching drift.

type UploadOpts = { contentType?: string; upsert?: boolean };
type UploadResp = { data: unknown; error: { message: string } | null };
type SignedResp = {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
};

type Capture = {
  buckets: string[];
  uploads: Array<{
    path: string;
    body: Buffer | Blob | ArrayBuffer;
    opts: UploadOpts;
  }>;
  signedUrls: Array<{ path: string; expiresIn: number }>;
};

function mockDb(resp: {
  upload?: UploadResp;
  signedUrl?: SignedResp;
}): { db: DbClient; cap: Capture } {
  const cap: Capture = {
    buckets: [],
    uploads: [],
    signedUrls: [],
  };
  const storage = {
    from: (bucket: string) => {
      cap.buckets.push(bucket);
      return {
        upload: (
          path: string,
          body: Buffer | Blob | ArrayBuffer,
          opts: UploadOpts,
        ) => {
          cap.uploads.push({ path, body, opts });
          return Promise.resolve(
            resp.upload ?? { data: { path }, error: null },
          );
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

const COMPANY_ID = "11111111-2222-3333-4444-555555555555";
const TEST_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("CERT_SIGNED_URL_SECONDS", () => {
  it("defaults to 60s (short-lived so leaked URLs expire quickly)", () => {
    expect(CERT_SIGNED_URL_SECONDS).toBe(60);
  });
});

describe("uploadCertificatePdf", () => {
  it("uploads to the certificates bucket at <company>/<test>.pdf", async () => {
    const { db, cap } = mockDb({});
    const buf = Buffer.from("%PDF-1.4 fake");
    const r = await uploadCertificatePdf(db, COMPANY_ID, TEST_ID, buf);

    expect(r.path).toBe(`${COMPANY_ID}/${TEST_ID}.pdf`);
    expect(cap.buckets).toEqual(["certificates"]);
    expect(cap.uploads).toHaveLength(1);
    expect(cap.uploads[0].path).toBe(`${COMPANY_ID}/${TEST_ID}.pdf`);
    expect(cap.uploads[0].body).toBe(buf);
  });

  it("sets content type to application/pdf", async () => {
    const { db, cap } = mockDb({});
    await uploadCertificatePdf(db, COMPANY_ID, TEST_ID, Buffer.from("x"));
    expect(cap.uploads[0].opts.contentType).toBe("application/pdf");
  });

  it("uses upsert=true so regeneration is idempotent", async () => {
    const { db, cap } = mockDb({});
    await uploadCertificatePdf(db, COMPANY_ID, TEST_ID, Buffer.from("x"));
    expect(cap.uploads[0].opts.upsert).toBe(true);
  });

  it("throws when the storage SDK reports an error", async () => {
    const { db } = mockDb({
      upload: { data: null, error: { message: "bucket not found" } },
    });
    await expect(
      uploadCertificatePdf(db, COMPANY_ID, TEST_ID, Buffer.from("x")),
    ).rejects.toBeTruthy();
  });

  it("throws before touching storage when companyId is not a UUID", async () => {
    const { db, cap } = mockDb({});
    await expect(
      uploadCertificatePdf(db, "not-a-uuid", TEST_ID, Buffer.from("x")),
    ).rejects.toThrow(/bad companyId/);
    expect(cap.uploads).toHaveLength(0);
  });

  it("throws before touching storage when testResultId is not a UUID", async () => {
    const { db, cap } = mockDb({});
    await expect(
      uploadCertificatePdf(db, COMPANY_ID, "not-a-uuid", Buffer.from("x")),
    ).rejects.toThrow(/bad testResultId/);
    expect(cap.uploads).toHaveLength(0);
  });
});

describe("createCertificateSignedUrl", () => {
  it("signs the deterministic <company>/<test>.pdf path from the certificates bucket", async () => {
    const { db, cap } = mockDb({
      signedUrl: {
        data: { signedUrl: "https://signed.example/cert" },
        error: null,
      },
    });
    const url = await createCertificateSignedUrl(db, COMPANY_ID, TEST_ID);
    expect(url).toBe("https://signed.example/cert");
    expect(cap.buckets).toEqual(["certificates"]);
    expect(cap.signedUrls).toEqual([
      { path: `${COMPANY_ID}/${TEST_ID}.pdf`, expiresIn: 60 },
    ]);
  });

  it("defaults to a 60-second expiry (CERT_SIGNED_URL_SECONDS)", async () => {
    const { db, cap } = mockDb({});
    await createCertificateSignedUrl(db, COMPANY_ID, TEST_ID);
    expect(cap.signedUrls[0].expiresIn).toBe(CERT_SIGNED_URL_SECONDS);
  });

  it("forwards a custom expiry when supplied", async () => {
    const { db, cap } = mockDb({});
    await createCertificateSignedUrl(db, COMPANY_ID, TEST_ID, 300);
    expect(cap.signedUrls[0].expiresIn).toBe(300);
  });

  it("throws when the storage SDK reports an error (e.g. expired/missing object)", async () => {
    const { db } = mockDb({
      signedUrl: { data: null, error: { message: "not found" } },
    });
    await expect(
      createCertificateSignedUrl(db, COMPANY_ID, TEST_ID),
    ).rejects.toBeTruthy();
  });

  it("passes companyId as the leading path segment (RLS-relevant)", async () => {
    // The storage RLS policy gates on the leading folder equal to
    // user_company_id(). A regression that put the test id first would
    // silently fail every RLS check — pin it here.
    const { db, cap } = mockDb({});
    await createCertificateSignedUrl(db, COMPANY_ID, TEST_ID);
    expect(cap.signedUrls[0].path.split("/")[0]).toBe(COMPANY_ID);
  });

  it("throws before touching storage when companyId is not a UUID", async () => {
    const { db, cap } = mockDb({});
    await expect(
      createCertificateSignedUrl(db, "not-a-uuid", TEST_ID),
    ).rejects.toThrow(/bad companyId/);
    expect(cap.signedUrls).toHaveLength(0);
  });
});
