"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/**
 * Blok-style switch (https://blok.sitecore.com/primitives/switch) built on a
 * native checkbox input, so call sites keep the same `checked`/`onChange` API
 * as `Checkbox` and outer `<label>` wrappers keep working.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <span
      className={cn("relative inline-flex shrink-0 items-center", className)}
    >
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        className="peer absolute inset-0 cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className="h-5 w-9 rounded-full bg-black/25 transition-colors peer-checked:bg-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-primary/50 peer-disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4 peer-disabled:opacity-50"
      />
    </span>
  ),
);
Switch.displayName = "Switch";

export { Switch };
