"use client";

import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiEyeOutline,
  mdiWeb,
} from "@mdi/js";
import { useMemo, useState } from "react";

import { Icon } from "@/lib/icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag } from "@/components/workbox/badges";
import { commandHoverClasses } from "@/src/utils/command-direction";
import { formatDate, formatUser, lastPathSegment } from "@/src/utils/format";
import { groupByPage } from "@/src/utils/grouping";
import type { ItemLinks } from "@/src/utils/site-links";
import type { WorkboxItem, WorkflowCommand } from "@/src/types/workbox";

export function Pager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2 border-t border-border-muted px-4 py-3">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <Icon path={mdiChevronLeft} size={0.8} />
      </Button>
      <span className="text-xs text-text-subtle">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <Icon path={mdiChevronRight} size={0.8} />
      </Button>
    </div>
  );
}

export interface ItemTableProps {
  /** The full filtered list for the current state — this component pages it. */
  items: WorkboxItem[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Grouped display mode: data sources nest, expandable, under their page. */
  groupDatasources: boolean;
  /** Live/preview URLs for a row; empty object when none apply. */
  getItemLinks: (item: WorkboxItem) => ItemLinks;
  /** Rows whose command succeeded — shown grayed out, without controls. */
  invalidatedKeys: Set<string>;
  selectedKeys: Set<string>;
  onToggleKey: (key: string) => void;
  onToggleVisible: (keys: string[], selectAll: boolean) => void;
  commands: WorkflowCommand[];
  commandsLoading: boolean;
  onRunCommand: (items: WorkboxItem[], command: WorkflowCommand) => void;
  onOpenDetails: (item: WorkboxItem) => void;
  busyKeys: Set<string>;
}

export function ItemTable({
  items,
  page,
  pageSize,
  onPageChange,
  groupDatasources,
  getItemLinks,
  invalidatedKeys,
  selectedKeys,
  onToggleKey,
  onToggleVisible,
  commands,
  commandsLoading,
  onRunCommand,
  onOpenDetails,
  busyKeys,
}: ItemTableProps) {
  // Which command was clicked last per row, so the busy state can keep showing
  // that button (with the swipe animation) instead of a bare spinner.
  const [lastClicked, setLastClicked] = useState<Record<string, string>>({});

  // Page keys whose data-source group is currently expanded.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const { topLevel, childrenByKey } = useMemo(
    () =>
      groupDatasources
        ? groupByPage(items)
        : { topLevel: items, childrenByKey: {} as Record<string, WorkboxItem[]> },
    [groupDatasources, items],
  );

  const totalPages = Math.max(1, Math.ceil(topLevel.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = topLevel.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Select-all covers the rendered, still-selectable rows: top-level ones plus
  // the children of expanded groups. Moved rows can no longer be selected.
  const visibleKeys = visible
    .flatMap((item) => [
      item,
      ...(expandedKeys.has(item.key) ? (childrenByKey[item.key] ?? []) : []),
    ])
    .filter((item) => !invalidatedKeys.has(item.key))
    .map((item) => item.key);
  const selectedVisible = visibleKeys.filter((key) => selectedKeys.has(key));
  const allVisibleSelected =
    visibleKeys.length > 0 && selectedVisible.length === visibleKeys.length;

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderRow = (item: WorkboxItem, child: boolean) => {
    const busy = busyKeys.has(item.key);
    const moved = invalidatedKeys.has(item.key);
    const children = child ? [] : (childrenByKey[item.key] ?? []);
    const expanded = expandedKeys.has(item.key);

    const links = getItemLinks(item);

    // Only the path opens the details drawer; the name is plain text.
    const nameBlock = (
      <div className="text-left">
        <span className="font-bold text-on-surface">
          {item.displayName || lastPathSegment(item.path)}
        </span>
        {moved ? (
          <span className="mt-0.5 block font-mono text-xs text-black/35">
            {item.path}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onOpenDetails(item)}
            className="mt-0.5 block cursor-pointer text-left font-mono text-xs text-black/35"
          >
            {item.path}
          </button>
        )}
        {!moved && (links.live || links.preview) && (
          <span className="mt-2 flex items-center gap-3 text-xs">
            {links.live && (
              <a
                href={links.live}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary-fg hover:underline"
              >
                <Icon path={mdiWeb} size={0.6} />
                View Live
              </a>
            )}
            {links.preview && (
              <a
                href={links.preview}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary-fg hover:underline"
              >
                <Icon path={mdiEyeOutline} size={0.6} />
                Preview {item.stateName}
              </a>
            )}
          </span>
        )}
      </div>
    );

    return (
      <tr
        key={item.key}
        className={
          moved
            ? "border-b border-border-muted opacity-45 grayscale last:border-b-0"
            : "border-b border-border-muted last:border-b-0 hover:bg-surface-container-low"
        }
      >
        <td
          className={cn(
            "px-4 py-3 align-top",
            // Child rows read as nested: a bar on the left edge and the
            // checkbox nudged right; the expanded parent gets a half-size bar
            // so the group reads as one block.
            child && "border-l-4 border-l-[#019ea5] pl-8",
            !child && expanded && children.length > 0 && "border-l-4 border-l-[#019ea5]",
          )}
        >
          {!moved && (
            <Checkbox
              checked={selectedKeys.has(item.key)}
              onChange={() => onToggleKey(item.key)}
              aria-label={`Select ${item.path}`}
            />
          )}
        </td>
        <td className={cn("px-4 py-3 align-top", child && "pl-12")}>
          <div className="flex items-start gap-2">
            {groupDatasources &&
              !child &&
              (children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.key)}
                  aria-label={
                    expanded ? "Collapse data sources" : "Expand data sources"
                  }
                  className="mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-neutral-bg"
                >
                  <Icon
                    path={mdiChevronRight}
                    size={0.7}
                    className={cn(
                      "transition-transform",
                      expanded && "rotate-90",
                    )}
                  />
                </button>
              ) : (
                <span className="size-5 shrink-0" />
              ))}
            {nameBlock}
            {children.length > 0 && (
              <span className="mt-0.5 text-xs text-text-subtle">
                {children.length} data source{children.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 align-top">
          <div className="flex flex-col items-start gap-1">
            <Tag>{item.hasLayout ? "Page" : "Data source"}</Tag>
            <Tag mono>
              {item.language} v{item.version}
            </Tag>
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-on-surface-variant">
          {formatDate(item.updated)}
          <span className="mt-0.5 block text-xs text-text-subtle">
            {formatUser(item.updatedBy)}
          </span>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex flex-wrap gap-2">
            {moved ? (
              <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                Moved
              </span>
            ) : busy ? (
              <span className="relative inline-flex h-9 items-center justify-center overflow-hidden rounded-xl border border-border-muted px-4 text-md font-bold text-text-subtle">
                <span className="opacity-50">
                  {commands.find(
                    (command) => command.commandId === lastClicked[item.key],
                  )?.displayName ?? "Running"}
                </span>
                <span className="workbox-blaze" />
              </span>
            ) : commandsLoading ? (
              <span className="text-xs text-text-subtle">Loading&hellip;</span>
            ) : commands.length === 0 ? (
              <span className="text-xs text-text-subtle">No commands</span>
            ) : (
              commands.map((command) => (
                <Button
                  key={command.commandId}
                  size="sm"
                  variant="outline"
                  className={commandHoverClasses(command.displayName)}
                  onClick={() => {
                    setLastClicked((prev) => ({
                      ...prev,
                      [item.key]: command.commandId,
                    }));
                    onRunCommand([item], command);
                  }}
                >
                  {command.displayName}
                </Button>
              ))
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-muted bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-muted text-xs font-bold uppercase tracking-wider text-text-subtle">
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={
                    selectedVisible.length > 0 && !allVisibleSelected
                  }
                  onChange={() =>
                    onToggleVisible(visibleKeys, !allVisibleSelected)
                  }
                  aria-label="Select all rows on this page"
                />
              </th>
              <th className="px-4 py-3 font-bold">Item</th>
              <th className="px-4 py-3 font-bold">Type/Version</th>
              <th className="px-4 py-3 font-bold">Updated/By</th>
              <th className="px-4 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.flatMap((item) => [
              renderRow(item, false),
              ...(expandedKeys.has(item.key)
                ? (childrenByKey[item.key] ?? []).map((childItem) =>
                    renderRow(childItem, true),
                  )
                : []),
            ])}
          </tbody>
        </table>
      </div>

      <Pager page={safePage} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
