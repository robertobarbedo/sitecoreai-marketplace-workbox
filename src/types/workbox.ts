/** Shared types for the Workbox app. */

/** A state inside a workflow definition. */
export interface WorkflowState {
  stateId: string;
  displayName: string;
  /** Final states are the "done" end of a workflow; classic Workbox lists them last. */
  final: boolean;
  /**
   * True when the state is not in the workflow definition and only exists
   * because a scanned item reported it (e.g. an item carrying a state id from
   * another workflow). Such states are only shown while they have items.
   */
  observed?: boolean;
}

/** A workflow definition plus its states, as read from the Authoring API. */
export interface WorkflowSummary {
  workflowId: string;
  displayName: string;
  states: WorkflowState[];
}

/** A command available from one state. */
export interface WorkflowCommand {
  commandId: string;
  displayName: string;
  /**
   * The command item's "Suppress Comment" field ("1" = true). Per the requested
   * behavior the comment dialog is shown ONLY when this is true; otherwise the
   * command runs immediately without asking.
   */
  suppressComment: boolean;
}

/**
 * One item *version* sitting in a workflow state — workflow state is a versioned
 * field, so v1 and v2 of the same item can be in different states and are listed
 * as separate rows (classic Workbox behaves the same way).
 */
export interface WorkboxItem {
  /** `itemId|language|version` — stable identity for selection and de-duping. */
  key: string;
  itemId: string;
  path: string;
  language: string;
  version: number;
  workflowId: string;
  workflowName: string;
  stateId: string;
  stateName: string;
  final: boolean;
  name: string;
  displayName: string;
  templateName: string;
  /** True when the item has layout details (`__Renderings` / `__Final Renderings`) — i.e. it is a page, not a data source. */
  hasLayout: boolean;
  /**
   * Raw `ds="..."` datasource references extracted from the layout XML —
   * GUIDs, absolute paths, or `local:/...` paths. Used to group a page's data
   * sources even when they don't live under `<page path>/data/`.
   */
  datasourceRefs: string[];
  /** Raw Sitecore ISO date (`yyyyMMddTHHmmssZ`) from `__Updated`. */
  updated: string;
  /** Raw `__Updated by` value, e.g. `sitecore\\jane@example.com`. */
  updatedBy: string;
}

/** Full field dump for the details drawer. */
export interface ItemFieldValue {
  name: string;
  value: string;
}

export interface WorkboxItemFull {
  itemId: string;
  path: string;
  language: string;
  version: number;
  name: string;
  displayName: string;
  templateName: string;
  updated: string;
  updatedBy: string;
  fields: ItemFieldValue[];
}

/** A scope the user can scan: a site root, or all content. */
export interface ScanScope {
  /** Stable id used in preferences and as the select value. */
  id: string;
  label: string;
  path: string;
}

/** Result of running one workflow command against one item version. */
export interface CommandRunResult {
  key: string;
  path: string;
  language: string;
  version: number;
  ok: boolean;
  /** Message or error text reported by the mutation. */
  message: string;
  nextStateId: string | null;
}

/** Progress reported while a scan is running. */
export interface ScanProgress {
  scanned: number;
  total: number;
  /** True when the safety cap stopped the scan before the end of the tree. */
  truncated: boolean;
}

/** Everything the scan produced, bucketed for the UI. */
export interface ScanResult {
  /** Every item version found in any workflow state, in path order. */
  items: WorkboxItem[];
  /** Workflow id → state id → items. */
  byWorkflow: Record<string, Record<string, WorkboxItem[]>>;
  progress: ScanProgress;
}

/**
 * Admin settings, stored in the content tree at
 * `/sitecore/system/Modules/Marketplace/Workbox/Settings` (JSON in the `Value`
 * field) — shared by everyone using the app in this environment, unlike the
 * per-user localStorage prefs.
 *
 * The three id lists share one convention: empty = everything is available;
 * exactly one entry = that option is fixed and its input disappears from the
 * Workbox UI; several entries = the input only offers those.
 */
export type PageDisplayMode = "grouped" | "pagesOnly" | "flat";

export interface WorkboxSettings {
  version: number;
  /** Scope ids (site root paths / `__all-content`) the app offers. */
  scopeIds: string[];
  /** Language codes the app offers. */
  languages: string[];
  /** Workflow ids the app offers. */
  workflowIds: string[];
  /** Show the Rows page-size selector in the toolbar. */
  showRows: boolean;
  /** Show the "Only my items" filter. */
  showOnlyMine: boolean;
  /** Show the "Show final states" toggle. */
  showFinalStates: boolean;
  /**
   * How pages and data sources are listed:
   * - `grouped`: pages as rows, their data sources expandable under them (default)
   * - `pagesOnly`: only pages
   * - `flat`: every item as its own row, with the user's "Show only pages" switch
   */
  pageDisplay: PageDisplayMode;
  /**
   * Commands on a page cascade to its data sources in the same state (found
   * under `<page path>/data/`): data sources run first, the page runs last.
   */
  commandsIncludeDatasources: boolean;
  /** Always filter to the user's own items; hides the "Only my items" switch. */
  forceOnlyMine: boolean;
  /** Publish to Experience Edge automatically (no prompt) when items reach a final state. */
  autoPublish: boolean;
  /**
   * Domain serving the preview/staging head, used for each row's "Preview"
   * link. The Sites API exposes no preview host, so this is manual; empty
   * hides the link.
   */
  previewDomain: string;
  updatedAt: string;
}

/** Per-user view preferences (localStorage, not the content tree). */
export interface WorkboxPrefs {
  scopeId?: string;
  language?: string;
  rowPageSize?: number;
  includeFinal?: boolean;
  onlyMine?: boolean;
  onlyPages?: boolean;
}
