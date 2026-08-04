"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  /** Renders the native indeterminate ("some selected") state. */
  indeterminate?: boolean;
};

/**
 * Native checkbox — the table needs hundreds of these per page, so this stays a
 * plain input with `accent-color` rather than a Radix primitive.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate = false, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => innerRef.current!, []);

    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
      <input
        ref={innerRef}
        type="checkbox"
        className={cn(
          "size-4 shrink-0 cursor-pointer rounded-md border-border-muted accent-[var(--primary)] outline-none focus-visible:ring-[3px] focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
