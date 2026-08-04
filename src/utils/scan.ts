import type { ClientSDK } from "@sitecore-marketplace-sdk/client";

import {
  DEFAULT_LANGUAGE,
  SCAN_MAX_PAGES,
  SCAN_PAGE_SIZE,
} from "@/src/constants";
import type { ScanProgress, ScanResult, WorkboxItem } from "@/src/types/workbox";
import { idKey } from "@/src/utils/format";
import {
  queryItemByPath,
  scanWorkflowItems,
  stripBraces,
} from "@/src/utils/sitecore-graphql";

/**
 * The API can resolve a path the user cannot actually read to an item whose id
 * is the empty GUID; scanning with it fails downstream with a confusing
 * "'{00000000-...}' template doesn't exist" error. Treat it as scope-not-found.
 */
const EMPTY_ITEM_ID = "0".repeat(32);

export interface ScanOptions {
  scopePath: string;
  language: string;
}

export interface ScanHandlers {
  onProgress?: (progress: ScanProgress) => void;
  /** Polled between pages so the Stop button can end the run mid-flight. */
  isCancelled?: () => boolean;
}

export class ScopeNotFoundError extends Error {
  constructor(public readonly scopePath: string) {
    super(`Scope item not found: ${scopePath}`);
    this.name = "ScopeNotFoundError";
  }
}

/**
 * Buckets items by workflow id, then state id, preserving the incoming order.
 * Both levels are keyed by `idKey` so buckets line up with the workflow
 * definition regardless of which GUID shape each source returned.
 */
export function groupItems(
  items: WorkboxItem[],
): Record<string, Record<string, WorkboxItem[]>> {
  const byWorkflow: Record<string, Record<string, WorkboxItem[]>> = {};
  for (const item of items) {
    const states = (byWorkflow[idKey(item.workflowId)] ??= {});
    (states[idKey(item.stateId)] ??= []).push(item);
  }
  return byWorkflow;
}

/**
 * Walks every item under `scopePath` through the search index and keeps the ones
 * that are in a workflow state.
 *
 * The index is only used to enumerate items — the workflow state itself comes
 * from the returned item, so results are never stale relative to the index's
 * copy of `__Workflow state`.
 */
export async function runScan(
  client: ClientSDK,
  sitecoreContextId: string,
  { scopePath, language }: ScanOptions,
  handlers: ScanHandlers = {},
): Promise<ScanResult> {
  const { onProgress, isCancelled } = handlers;

  // The lookup only exists to turn the path into an item id, which is
  // language-invariant — so it always runs in the default language. Looking the
  // path up in the selected language fails with a "'{00000000-...}' template
  // doesn't exist" error when the scope item has no version in that language.
  const scope = await queryItemByPath(
    client,
    sitecoreContextId,
    scopePath,
    DEFAULT_LANGUAGE,
  );
  if (!scope || stripBraces(scope.itemId) === EMPTY_ITEM_ID) {
    throw new ScopeNotFoundError(scopePath);
  }

  const items: WorkboxItem[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  let total = 0;
  let truncated = false;
  let pageIndex = 0;

  while (pageIndex < SCAN_MAX_PAGES) {
    if (isCancelled?.()) {
      truncated = true;
      break;
    }

    const page = await scanWorkflowItems(client, sitecoreContextId, {
      scopeItemId: scope.itemId,
      language,
      pageIndex,
      pageSize: SCAN_PAGE_SIZE,
    });

    total = page.totalCount;
    scanned += page.rawCount;

    for (const item of page.items) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      items.push(item);
    }

    onProgress?.({ scanned, total, truncated: false });

    // The API ran out of results, or we have seen everything it counted.
    if (page.rawCount === 0 || scanned >= total) break;

    pageIndex += 1;
    if (pageIndex >= SCAN_MAX_PAGES && scanned < total) truncated = true;
  }

  items.sort((a, b) => a.path.localeCompare(b.path) || a.version - b.version);

  const progress: ScanProgress = { scanned, total, truncated };
  onProgress?.(progress);

  return { items, byWorkflow: groupItems(items), progress };
}
