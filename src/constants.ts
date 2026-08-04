/** Item paths and tuning constants for the Workbox app. */

/** Every workflow definition lives directly under this folder. */
export const WORKFLOWS_ROOT = "/sitecore/system/Workflows";

/** Fallback scope when the environment exposes no sites. */
export const CONTENT_ROOT = "/sitecore/content";

/** Workflow only exists in the authoring database. */
export const MASTER_DATABASE = "master";

export const DEFAULT_LANGUAGE = "en";

/** Sentinel for the "All languages" scope option (drops the `_language` criterion). */
export const ALL_LANGUAGES = "*";

/** Documents requested per `search` call while scanning. */
export const SCAN_PAGE_SIZE = 200;

/**
 * Safety cap on a single scan. A scan reads every item under the scope, so an
 * unbounded run against a huge tree would hammer the API; when the cap trips the
 * UI says the results are partial and offers a narrower scope.
 */
export const SCAN_MAX_PAGES = 25;

/** Row counts offered in the toolbar. */
export const ROW_PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_ROW_PAGE_SIZE = 25;

/** localStorage key holding the per-user view preferences. */
export const PREFS_STORAGE_KEY = "sitecoreai-workbox-prefs";

/* ------------------------------------------------------- settings storage */

/** Well-known template ids used when creating the settings items. */
export const SITECORE_TEMPLATES = {
  MODULE_FOLDER: "{A87A00B1-E6DB-45AB-8B54-636FEC3B5523}",
  SETTINGS_ITEM: "{D2923FEE-DA4E-49BE-830C-E27764DFA269}",
} as const;

/** `/sitecore/system/Modules` — parent of the Marketplace folder. */
export const MODULES_PARENT_ID = "{08477468-D438-43D4-9D6A-6D84A611971C}";

/** Content tree paths where this app persists its admin settings. */
export const SETTINGS_PATHS = {
  MARKETPLACE_FOLDER: "/sitecore/system/Modules/Marketplace",
  MODULE_FOLDER: "/sitecore/system/Modules/Marketplace/Workbox",
  SETTINGS_ITEM: "/sitecore/system/Modules/Marketplace/Workbox/Settings",
} as const;

export const MARKETPLACE_FOLDER_NAME = "Marketplace";
export const MODULE_FOLDER_NAME = "Workbox";
export const SETTINGS_ITEM_NAME = "Settings";
