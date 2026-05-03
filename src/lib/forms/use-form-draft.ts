"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import {
  isDraftStale,
  type StoredDraft,
} from "./draft-keys";

// Debounce keeps a noisy keystroke storm from thrashing localStorage,
// but on mobile the window we have before a tab tear-down can be
// surprisingly short — a long debounce is how drafts get lost. 100ms
// is short enough that any reasonable pause-and-close still flushes,
// while keeping per-keystroke writes off the hot path. Belt-and-
// suspenders: pagehide / visibilitychange:hidden flush synchronously
// via getValues() so an in-flight debounce can't lose data.
const WRITE_DEBOUNCE_MS = 100;

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
// pushes it into the form. On every watched change: debounces a write,
// and forces a synchronous flush on pagehide / visibilitychange:hidden
// so a tab-close can't lose the in-flight draft. Never writes until
// after the initial hydration attempt to avoid clobbering a fresh
// draft with empty defaults.
//
// Diagnostics: in non-prod (or with NEXT_PUBLIC_DRAFT_DEBUG=1), the
// hook exposes window.__bfDraftInspect() returning the current key,
// hydration state, and the stored payload — paste into Safari Web
// Inspector / Chrome DevTools to see exactly what landed in storage.
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
  const restoredRef = useRef(false);
  const lastWriteRef = useRef<number>(0);

  // 1) Hydrate. Runs exactly once per key. Reads the blob, checks TTL,
  // and calls reset() if the payload looks sane.
  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    hydratedRef.current = false;
    restoredRef.current = false;
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
        restoredRef.current = true;
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

  // 2) Persist. Debounced subscription to watch() + a synchronous flush
  // on tab teardown so an in-flight debounce timer can't be cancelled
  // by React's unmount cleanup before the write lands.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function flush(values: TValues) {
      const payload: StoredDraft<TValues> = {
        savedAt: Date.now(),
        values,
      };
      safeSet(key, JSON.stringify(payload));
      lastWriteRef.current = payload.savedAt;
    }

    const sub = form.watch((values) => {
      if (!hydratedRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => flush(values as TValues), WRITE_DEBOUNCE_MS);
    });

    function flushNow() {
      if (!hydratedRef.current) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      // Pull the freshest values straight out of the form rather than
      // trusting a possibly-stale closure capture.
      flush(form.getValues() as TValues);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushNow();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", flushNow);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", flushNow);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (timer) clearTimeout(timer);
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // 3) Diagnostics. Exposed on window in dev or with the opt-in env
  // flag so the user can peek state from Web Inspector / DevTools when
  // the pill doesn't appear: `__bfDraftInspect()` →
  //   { key, hydrated, restored, lastWriteMs, raw, parsed }.
  useEffect(() => {
    const enableInspect =
      typeof window !== "undefined" &&
      (process.env.NODE_ENV !== "production" ||
        process.env.NEXT_PUBLIC_DRAFT_DEBUG === "1");
    if (!enableInspect) return;
    const win = window as unknown as { __bfDraftInspect?: () => unknown };
    win.__bfDraftInspect = () => {
      const raw = safeGet(key);
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = "<corrupt JSON>";
      }
      return {
        key,
        hydrated: hydratedRef.current,
        restored: restoredRef.current,
        lastWriteMs: lastWriteRef.current,
        raw,
        parsed,
      };
    };
    return () => {
      delete win.__bfDraftInspect;
    };
  }, [key]);

  function clear() {
    safeRemove(key);
    setRestored(false);
    restoredRef.current = false;
  }

  return { ready, restored, clear };
}
