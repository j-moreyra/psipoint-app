// Draft persistence keys + expiry math. Kept pure so the key
// construction + TTL decisions can be unit-tested without stubbing
// localStorage or Date.now() through a hook.
//
// Storage layout (one entry per device):
//   key   = backflo:draft:test:v<schema>:<deviceId>
//   value = { savedAt: <unix-ms>, values: <form-snapshot> }
//
// Versioning: bump DRAFT_SCHEMA_VERSION any time the test-form field
// shape changes in a backwards-incompatible way. Readers with a
// different version suffix see a miss instead of hydrating
// half-mismatched data.

export const DRAFT_SCHEMA_VERSION = 1;

// Drafts older than this are silently dropped on read. 7 days matches
// the "I came back to the same device next week" case without carrying
// drafts from long-abandoned sessions forward indefinitely.
export const DRAFT_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredDraft<T> = {
  savedAt: number;
  values: T;
};

// Builds a deterministic localStorage key for the test form. Same
// (deviceId, version) always produces the same key — a tester who
// navigates away and returns to the same device resumes their draft;
// two different devices can't collide.
export function testDraftKey(deviceId: string): string {
  if (!deviceId) throw new Error("testDraftKey: deviceId is required");
  return `backflo:draft:test:v${DRAFT_SCHEMA_VERSION}:${deviceId}`;
}

// Splits "is this draft too old to use" from the hook so the stale
// window is testable without mocking `new Date()` inside a component.
export function isDraftStale(savedAt: number, now: number): boolean {
  if (!Number.isFinite(savedAt) || savedAt <= 0) return true;
  return now - savedAt > DRAFT_STALE_MS;
}
