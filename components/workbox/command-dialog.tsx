"use client";

import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiLoading } from "@mdi/js";

import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { lastPathSegment } from "@/src/utils/format";
import type {
  CommandRunResult,
  WorkboxItem,
  WorkflowCommand,
} from "@/src/types/workbox";

export interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: WorkflowCommand | null;
  items: WorkboxItem[];
  comment: string;
  onCommentChange: (comment: string) => void;
  isRunning: boolean;
  results: CommandRunResult[];
  onConfirm: () => void;
}

export function CommandDialog({
  open,
  onOpenChange,
  command,
  items,
  comment,
  onCommentChange,
  isRunning,
  results,
  onConfirm,
}: CommandDialogProps) {
  if (!command) return null;

  const finished = !isRunning && results.length > 0;
  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A run must not be abandoned half-way: closing is blocked while it runs.
        if (isRunning) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {finished
              ? `${command.displayName} — results`
              : `${command.displayName}`}
          </DialogTitle>
          <DialogDescription>
            {finished
              ? `${succeeded} succeeded, ${failed} failed.`
              : `This runs the "${command.displayName}" workflow command on ${items.length} item${items.length === 1 ? "" : "s"}.`}
          </DialogDescription>
        </DialogHeader>

        {!isRunning && !finished && (
          <>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border-muted bg-surface-container-low p-3">
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.key} className="text-xs">
                    <span className="font-bold text-on-surface">
                      {item.displayName || lastPathSegment(item.path)}
                    </span>
                    <span className="ml-2 font-mono text-text-subtle">
                      {item.language} v{item.version}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                Comment (optional)
              </span>
              <Textarea
                rows={3}
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                placeholder="Why is this being approved, rejected or submitted?"
              />
            </label>
          </>
        )}

        {(isRunning || finished) && (
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border-muted p-3">
            {results.map((result) => (
              <div key={result.key} className="flex items-start gap-2 text-xs">
                <Icon
                  path={
                    result.ok ? mdiCheckCircleOutline : mdiAlertCircleOutline
                  }
                  size={0.7}
                  className={
                    result.ok
                      ? "mt-0.5 shrink-0 text-success"
                      : "mt-0.5 shrink-0 text-danger"
                  }
                />
                <div className="min-w-0">
                  <span className="font-mono text-text-subtle">
                    {result.path}
                  </span>
                  <span className="ml-2 font-mono text-text-subtle">
                    {result.language} v{result.version}
                  </span>
                  {!result.ok && (
                    <p className="text-danger-fg">{result.message}</p>
                  )}
                </div>
              </div>
            ))}

            {isRunning && (
              <div className="flex items-center gap-2 pt-1 text-xs text-text-subtle">
                <Icon path={mdiLoading} size={0.7} className="animate-spin" />
                Running {results.length + 1} of {items.length}&hellip;
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {finished ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={isRunning}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button disabled={isRunning} onClick={onConfirm}>
                {isRunning ? "Running…" : "Confirm"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
