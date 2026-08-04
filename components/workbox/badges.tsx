import { cn } from "@/lib/utils";

/** Workflow state pill — final states read as "done", everything else as pending. */
export function StateBadge({
  label,
  final,
  className,
}: {
  label: string;
  final: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        final
          ? "bg-success-bg text-success-fg"
          : "bg-warning-bg text-warning-fg",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Neutral eyebrow used for template names, language and version. */
export function Tag({
  children,
  mono = false,
  className,
}: {
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-neutral-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-fg",
        mono && "font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}
