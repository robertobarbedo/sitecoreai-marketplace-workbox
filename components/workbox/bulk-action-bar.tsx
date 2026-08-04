"use client";

import { mdiClose } from "@mdi/js";

import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { commandHoverClasses } from "@/src/utils/command-direction";
import type { WorkflowCommand } from "@/src/types/workbox";

export function BulkActionBar({
  selectedCount,
  commands,
  onRunCommand,
  onClear,
  disabled,
}: {
  selectedCount: number;
  commands: WorkflowCommand[];
  onRunCommand: (command: WorkflowCommand) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-primary bg-primary-bg p-4">
      <span className="font-bold text-primary-fg">
        {selectedCount} selected
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {commands.length === 0 ? (
          <span className="text-sm text-primary-fg opacity-80">
            No command is available from this state.
          </span>
        ) : (
          commands.map((command) => (
            <Button
              key={command.commandId}
              size="sm"
              variant="outline"
              className={commandHoverClasses(command.displayName)}
              disabled={disabled}
              onClick={() => onRunCommand(command)}
            >
              {command.displayName}
            </Button>
          ))
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={disabled}
        className="ml-auto"
      >
        <Icon path={mdiClose} size={0.8} />
        Clear
      </Button>
    </div>
  );
}
