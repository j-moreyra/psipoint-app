"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Unit 7: shell only — opens a placeholder panel on focus-with-query.
// Unit 8 wires unifiedSearch() behind the panel, adds debounce, and
// renders the three grouped sections with "Start Test" shortcuts.
//
// The search bar lives in the app header for every authed route, so
// it's a client component (focus, panel state, cmd-k shortcut all
// require the browser). Rendering happens inside app-shell.tsx's
// server boundary.

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl-K focuses the search input (desktop keyboard shortcut).
  // No-ops on mobile where the bar is tap-to-focus anyway.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click-outside closes the panel. Using pointerdown (not click) so a
  // tap that starts outside and drags in doesn't flicker the panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setQuery(next);
    setOpen(next.trim().length > 0);
  }

  function handleFocus() {
    if (query.trim().length > 0) setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[220px] sm:max-w-xs md:max-w-sm"
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Search customers, locations, serials..."
        aria-label="Search customers, service locations, and device serials"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent pl-8 pr-2.5 py-1 text-base transition-colors outline-none",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "md:text-sm dark:bg-input/30",
        )}
      />
      {open ? (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
        >
          <SearchPanelPlaceholder query={query} />
        </div>
      ) : null}
    </div>
  );
}

// Unit 7 placeholder. Unit 8 replaces this with three grouped result
// sections + the Start Test shortcut.
function SearchPanelPlaceholder({ query }: { query: string }) {
  return (
    <div className="px-3 py-4 text-sm text-muted-foreground">
      <p>
        Searching for{" "}
        <span className="font-medium text-foreground">
          {`"${query.trim()}"`}
        </span>
        …
      </p>
      <p className="mt-1 text-xs">Results will appear here in unit 8.</p>
    </div>
  );
}
