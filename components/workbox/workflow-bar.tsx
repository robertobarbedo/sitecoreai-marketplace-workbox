"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { idKey } from "@/src/utils/format";
import type { WorkflowState } from "@/src/types/workbox";

export interface WorkflowBarProps {
  states: WorkflowState[];
  counts: Record<string, number>;
  selectedStateId: string;
  onStateChange: (stateId: string) => void;
}

/**
 * The state tabs for the selected workflow. The workflow picker itself lives in
 * the ScopeToolbar, next to the other filters.
 */
export function WorkflowBar({
  states,
  counts,
  selectedStateId,
  onStateChange,
}: WorkflowBarProps) {
  if (states.length === 0) return null;

  return (
    <Tabs value={selectedStateId} onValueChange={onStateChange}>
      <TabsList className="w-full justify-start overflow-x-auto">
        {states.map((state) => {
          // Buckets are keyed by normalized id — the raw state GUID from the
          // workflow definition has a different shape and would miss.
          const count = counts[idKey(state.stateId)] ?? 0;
          const active = idKey(state.stateId) === idKey(selectedStateId);
          return (
            // The id in the tooltip disambiguates same-named states: the tab
            // list merges definition states with the states items report, and
            // a renamed/recreated workflow can hold two states with one name.
            <TabsTrigger
              key={state.stateId}
              value={state.stateId}
              title={state.stateId}
            >
              {state.displayName}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active
                    ? "bg-primary-bg text-primary-fg"
                    : "bg-neutral-bg text-neutral-fg",
                )}
              >
                {count}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
