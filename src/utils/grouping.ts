import { idKey } from "@/src/utils/format";
import type { WorkboxItem } from "@/src/types/workbox";

/**
 * A data source belongs to a page when either:
 * - it lives under `<page path>/data/...` (page-local data folder), or
 * - the page's layout XML references it via a `ds="..."` attribute — by GUID,
 *   absolute path, or SXA `local:/...` path (resolved against the page path).
 *
 * Matching is case-insensitive, same language, within one state bucket — both
 * for the grouped table view and for cascading commands.
 */
function datasourcePrefix(page: WorkboxItem): string {
  return `${page.path.toLowerCase()}/data/`;
}

const GUID_REF =
  /^\{?[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}\}?$/;

/** Builds a predicate deciding whether an item is a data source of `page`. */
export function buildPageMatcher(
  page: WorkboxItem,
): (item: WorkboxItem) => boolean {
  if (!page.hasLayout) return () => false;

  const prefix = datasourcePrefix(page);
  const refIds = new Set<string>();
  const refPaths = new Set<string>();

  for (const ref of page.datasourceRefs) {
    if (GUID_REF.test(ref)) {
      refIds.add(idKey(ref));
    } else if (ref.toLowerCase().startsWith("local:")) {
      refPaths.add(`${page.path}${ref.slice("local:".length)}`.toLowerCase());
    } else if (ref.startsWith("/")) {
      refPaths.add(ref.toLowerCase());
    }
  }

  return (item) => {
    if (item.hasLayout || item.key === page.key) return false;
    if (item.language !== page.language) return false;
    const lowerPath = item.path.toLowerCase();
    return (
      lowerPath.startsWith(prefix) ||
      refIds.has(idKey(item.itemId)) ||
      refPaths.has(lowerPath)
    );
  };
}

/** Data-source items of `page` found in `pool`, in pool order. */
export function findPageDatasources(
  page: WorkboxItem,
  pool: WorkboxItem[],
): WorkboxItem[] {
  const matches = buildPageMatcher(page);
  return pool.filter(matches);
}

/**
 * The page's OWN data sources only — the items under `<page path>/data/`.
 * Shared data sources (matched by layout reference elsewhere) are deliberately
 * excluded: they may be used by other pages, so a command on one page must not
 * drag them along. This is what the command cascade uses.
 */
export function findPageLocalDatasources(
  page: WorkboxItem,
  pool: WorkboxItem[],
): WorkboxItem[] {
  if (!page.hasLayout) return [];
  const prefix = datasourcePrefix(page);
  return pool.filter(
    (item) =>
      !item.hasLayout &&
      item.key !== page.key &&
      item.language === page.language &&
      item.path.toLowerCase().startsWith(prefix),
  );
}

export interface GroupedRows {
  /**
   * Pages only, in input order. Data sources exist solely inside the groups —
   * one that belongs to no listed page is not shown at all in grouped mode.
   */
  topLevel: WorkboxItem[];
  /** Page key → its data sources. A data source appears under one page only. */
  childrenByKey: Record<string, WorkboxItem[]>;
}

export function groupByPage(items: WorkboxItem[]): GroupedRows {
  const pages = items.filter((item) => item.hasLayout);
  const matchers = pages.map((page) => buildPageMatcher(page));
  const childrenByKey: Record<string, WorkboxItem[]> = {};

  for (const item of items) {
    if (item.hasLayout) continue;
    // First matching page row wins, so a data source is listed exactly once
    // even when several versions of its page sit in the same state.
    const ownerIndex = matchers.findIndex((matches) => matches(item));
    if (ownerIndex >= 0) {
      (childrenByKey[pages[ownerIndex].key] ??= []).push(item);
    }
  }

  return { topLevel: pages, childrenByKey };
}

/**
 * Expands a command's target list per the cascade setting: each page is
 * preceded by its OWN data sources (under `<page path>/data/` — shared ones
 * are never included), so data sources run first and the page runs last.
 * Duplicates are dropped, order otherwise preserved.
 */
export function expandWithDatasources(
  items: WorkboxItem[],
  pool: WorkboxItem[],
  includeDatasources: boolean,
): WorkboxItem[] {
  if (!includeDatasources) return items;

  const result: WorkboxItem[] = [];
  const seen = new Set<string>();
  const push = (item: WorkboxItem) => {
    if (!seen.has(item.key)) {
      seen.add(item.key);
      result.push(item);
    }
  };

  for (const item of items) {
    for (const datasource of findPageLocalDatasources(item, pool)) {
      push(datasource);
    }
    push(item);
  }
  return result;
}
