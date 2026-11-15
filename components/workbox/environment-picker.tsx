"use client";

import { useEffect, useRef, useState } from "react";
import { mdiCheck, mdiChevronDown, mdiChevronRight } from "@mdi/js";

import { Icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

/*
 * Shared across the Marketplace apps (Redirect Manager, Workbox, Dictionary):
 * keep the copies identical.
 */

export interface EnvironmentOption {
  id: string;
  label: string;
}

/**
 * The quiet line above the app header that says which environment the app is
 * working on and lets the user switch. Rendered only when the host reports
 * more than one environment (the Standalone extension point); opened as Full
 * Screen inside an environment there is nothing to choose, so nothing shows.
 */
export function EnvironmentBar<T extends EnvironmentOption>({
  environments,
  selected,
  disabled = false,
  onSelect,
}: {
  environments: T[];
  selected: T;
  disabled?: boolean;
  onSelect: (environment: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (environments.length < 2) return null;

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 text-xs">
      <span className="font-semibold uppercase tracking-wider text-text-subtle">
        Environment
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="-mx-1.5 flex items-center gap-0.5 rounded-md px-1.5 py-1 font-semibold text-on-surface hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {selected.label}
        <Icon path={mdiChevronDown} size={0.6} className="text-text-subtle" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-80 min-w-64 overflow-y-auto rounded-xl border border-border-muted bg-white p-1.5 shadow-lg">
          {environments.map((environment) => {
            const current = environment.id === selected.id;
            return (
              <button
                key={environment.id}
                type="button"
                aria-current={current || undefined}
                onClick={() => {
                  setOpen(false);
                  if (!current) onSelect(environment);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-black/5",
                  current && "font-semibold",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{environment.label}</span>
                {current && (
                  <Icon path={mdiCheck} size={0.65} className="text-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * First open with several environments and none remembered: ask, rather than
 * silently working on whichever environment happens to be listed first.
 */
export function EnvironmentChooser<T extends EnvironmentOption>({
  environments,
  onSelect,
}: {
  environments: T[];
  onSelect: (environment: T) => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-[480px] rounded-xl border border-border-muted bg-white p-6">
      <h2 className="text-lg font-bold text-on-surface">Choose an environment</h2>
      <p className="mt-1 text-sm text-text-subtle">
        This app works on one environment at a time. You can switch at the top
        of the page whenever you need to.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {environments.map((environment) => (
          <li key={environment.id}>
            <button
              type="button"
              onClick={() => onSelect(environment)}
              className="flex w-full items-center gap-2 rounded-xl border border-border-muted px-4 py-3 text-left font-semibold hover:border-primary hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="min-w-0 flex-1 truncate">{environment.label}</span>
              <Icon path={mdiChevronRight} size={0.75} className="text-text-subtle" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
