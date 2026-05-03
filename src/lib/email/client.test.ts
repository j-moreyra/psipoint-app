import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock the Resend SDK at the module boundary. The fake Resend records
// the API key it was constructed with and exposes an `emails.send` spy
// that returns whatever the test sets up.

type SendResp = {
  data: { id: string } | null;
  error: { name: string; message: string } | null;
};

const constructorSpy = vi.fn();
const sendSpy = vi.fn<(args: unknown) => Promise<SendResp>>(async () => ({
  data: { id: "msg_1" },
  error: null,
}));

vi.mock("resend", () => ({
  Resend: class {
    constructor(key: string) {
      constructorSpy(key);
    }
    emails = {
      send: (args: unknown) => sendSpy(args),
    };
  },
}));

// `server-only` is a marker package that throws in non-server contexts.
// Stub it so the client module can be imported in a Node test env.
vi.mock("server-only", () => ({}));

const ORIGINAL_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_FROM = process.env.RESEND_FROM_EMAIL;

beforeEach(() => {
  constructorSpy.mockClear();
  sendSpy.mockClear();
  sendSpy.mockResolvedValue({ data: { id: "msg_1" }, error: null });
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_FROM === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = ORIGINAL_FROM;
  // Drop the cached module so each test observes a fresh lazy-init.
  vi.resetModules();
});

async function loadClient() {
  return await import("./client");
}

const SEND_ARGS = {
  to: "jane@example.com",
  subject: "Backflow test passed",
  html: "<p>hi</p>",
  text: "hi",
  attachment: {
    filename: "backflow-test-BF-001-2026-04-19.pdf",
    content: Buffer.from("%PDF-fake"),
  },
};

describe("sendCertificateEmail — missing env", () => {
  it("throws when RESEND_API_KEY is unset (before constructing Resend)", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    const { sendCertificateEmail } = await loadClient();
    await expect(sendCertificateEmail(SEND_ARGS)).rejects.toThrow(
      /RESEND_API_KEY is not set/,
    );
    expect(constructorSpy).not.toHaveBeenCalled();
  });

  it("throws when RESEND_API_KEY is an empty string (truthy-gated)", async () => {
    process.env.RESEND_API_KEY = "";
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    const { sendCertificateEmail } = await loadClient();
    await expect(sendCertificateEmail(SEND_ARGS)).rejects.toThrow(
      /RESEND_API_KEY is not set/,
    );
  });

  it("throws a FROM-specific message when the API key is set but RESEND_FROM_EMAIL is not", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.RESEND_FROM_EMAIL;
    const { sendCertificateEmail } = await loadClient();
    await expect(sendCertificateEmail(SEND_ARGS)).rejects.toThrow(
      /RESEND_FROM_EMAIL is not set/,
    );
  });
});

describe("sendCertificateEmail — happy path", () => {
  it("lazy-constructs the Resend client with the env key on first send", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    const { sendCertificateEmail } = await loadClient();
    await sendCertificateEmail(SEND_ARGS);
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(constructorSpy).toHaveBeenCalledWith("re_test_key");
  });

  it("forwards from/to/subject/html/text/attachments to resend.emails.send", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    const { sendCertificateEmail } = await loadClient();
    await sendCertificateEmail(SEND_ARGS);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const payload = sendSpy.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
      attachments: Array<{ filename: string; content: Buffer }>;
    };
    expect(payload.from).toBe("certs@psipoint.app");
    expect(payload.to).toBe("jane@example.com");
    expect(payload.subject).toBe("Backflow test passed");
    expect(payload.html).toBe("<p>hi</p>");
    expect(payload.text).toBe("hi");
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toBe(
      "backflow-test-BF-001-2026-04-19.pdf",
    );
    expect(payload.attachments[0].content.toString()).toBe("%PDF-fake");
  });

  it("returns the id from a successful send", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    sendSpy.mockResolvedValueOnce({ data: { id: "msg_abc" }, error: null });
    const { sendCertificateEmail } = await loadClient();
    await expect(sendCertificateEmail(SEND_ARGS)).resolves.toEqual({
      id: "msg_abc",
    });
  });

  it("returns id: null when Resend omits an id on the success response", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    sendSpy.mockResolvedValueOnce({ data: null, error: null });
    const { sendCertificateEmail } = await loadClient();
    await expect(sendCertificateEmail(SEND_ARGS)).resolves.toEqual({
      id: null,
    });
  });
});

describe("sendCertificateEmail — error mapping", () => {
  it("throws when Resend returns an error (caller maps to emailErrorMessage)", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    sendSpy.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "domain not verified" },
    });
    const { sendCertificateEmail } = await loadClient();
    await expect(sendCertificateEmail(SEND_ARGS)).rejects.toBeTruthy();
  });
});

describe("sendCertificateEmail — caching", () => {
  it("reuses the same Resend client across multiple sends within a module load", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "certs@psipoint.app";
    const { sendCertificateEmail } = await loadClient();
    await sendCertificateEmail(SEND_ARGS);
    await sendCertificateEmail(SEND_ARGS);
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });
});
