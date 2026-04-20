"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import {
  isDraftStale,
  type StoredDraft,
} from "./draft-keys";

// Write-side debounce: 300ms strikes a balance between the phone
// typing cadence and localStorage write cost. Short enough that a
// mid-test tab kill surfaces the latest reading; long enough that
// ten keystrokes don't trigger ten syncs.
const WRITE_DEBOUNCE_MS = 300;

// SSR / Safari private-mode / quota-exceeded all surface as thrown
// exceptions from localStorage. Swallow them — the form still works
// without persistence; it's nice-to-have, not load-bearing.
function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export type UseFormDraftResult = {
  // True once the mount-time hydration attempt has finished, whether
  // or not a draft was actually restored. Lets the caller skip
  // rendering the "draft restored" notice until after the check runs.
  ready: boolean;
  // True when a live draft was found and pushed into the form.
  restored: boolean;
  // Imperative clear — the caller invokes this from the success handler
  // after the real save completes, and from any "discard draft" UI.
  clear: () => void;
};

// Persists a react-hook-form's values under `key` in localStorage.
// On mount: reads once, and if a non-stale draft is present, `reset(values)`
// pushes it into the form. On every watched change: debounces a write.
// Never writes until after the initial hydration attempt to avoid
// clobbering a fresh draft with empty defaults.
export function useFormDraft<TValues extends FieldValues>({
  key,
  form,
  enabled = true,
}: {
  key: string;
  form: UseFormReturn<TValues>;
  enabled?: boolean;
}): UseFormDraftResult {
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const hydratedRef = useRef(false);

  // 1) Hydrate. Runs exactly once per key. Reads the blob, checks TTL,
  // and calls reset() if the payload looks sane.
  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    hydratedRef.current = false;
    const raw = safeGet(key);
    if (!raw) {
      setReady(true);
      hydratedRef.current = true;
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredDraft<TValues>;
      if (isDraftStale(parsed.savedAt, Date.now())) {
        safeRemove(key);
      } else if (parsed.values && typeof parsed.values === "object") {
        form.reset(parsed.values, {
          keepDirty: false,
          keepErrors: false,
          keepTouched: false,
        });
        setRestored(true);
      }
    } catch {
      // Corrupt blob — nuke it so the next write starts clean.
      safeRemove(key);
    }
    setReady(true);
    hydratedRef.current = true;
    // key drives the hydration identity; intentionally leave `form` out
    // of deps since its reference is stable from react-hook-form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // 2) Persist. Debounced subscription to watch() — the RHF docs
  // recommend the unsubscribe pattern for side effects on value change.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = form.watch((values) => {
      if (!hydratedRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const payload: StoredDraft<TValues> = {
          savedAt: Date.now(),
          values: values as TValues,
        };
        safeSet(key, JSON.stringify(payload));
      }, WRITE_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  function clear() {
    safeRemove(key);
    setRestored(false);
  }

  return { ready, restored, clear };
}
