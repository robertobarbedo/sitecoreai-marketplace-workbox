import type { ClientSDK } from "@sitecore-marketplace-sdk/client";

import {
  DEFAULT_LANGUAGE,
  MARKETPLACE_FOLDER_NAME,
  MODULE_FOLDER_NAME,
  MODULES_PARENT_ID,
  SETTINGS_ITEM_NAME,
  SETTINGS_PATHS,
  SITECORE_TEMPLATES,
} from "@/src/constants";
import type { PageDisplayMode, WorkboxSettings } from "@/src/types/workbox";
import {
  createItem,
  getItemFieldValue,
  queryItemByPath,
  updateItemField,
} from "@/src/utils/sitecore-graphql";

/**
 * Admin settings live in the content tree at
 * `/sitecore/system/Modules/Marketplace/Workbox/Settings` (JSON in the `Value`
 * field), following the sibling apps' convention. The per-user view prefs stay
 * in localStorage (`prefs.ts`) — these settings are the shared, admin-fixed
 * configuration on top of them.
 */
export const DEFAULT_WORKBOX_SETTINGS: WorkboxSettings = {
  version: 1,
  scopeIds: [],
  languages: [],
  workflowIds: [],
  showRows: true,
  showOnlyMine: true,
  showFinalStates: false,
  pageDisplay: "grouped",
  commandsIncludeDatasources: true,
  forceOnlyMine: false,
  autoPublish: true,
  previewDomain: "",
  updatedAt: "",
};

const PAGE_DISPLAY_MODES: PageDisplayMode[] = ["grouped", "pagesOnly", "flat"];

/** Validates the stored mode; migrates the retired `forceOnlyPages` flag. */
function parsePageDisplay(
  parsed: Partial<WorkboxSettings> & { forceOnlyPages?: boolean },
): PageDisplayMode {
  if (
    parsed.pageDisplay &&
    PAGE_DISPLAY_MODES.includes(parsed.pageDisplay)
  ) {
    return parsed.pageDisplay;
  }
  return parsed.forceOnlyPages === true ? "pagesOnly" : "grouped";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** Loads the settings item; defaults when absent, unreadable, or unparsable. */
export async function loadWorkboxSettings(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<WorkboxSettings> {
  try {
    const raw = await getItemFieldValue(
      client,
      sitecoreContextId,
      SETTINGS_PATHS.SETTINGS_ITEM,
      "Value",
      DEFAULT_LANGUAGE,
    );
    if (!raw) return { ...DEFAULT_WORKBOX_SETTINGS };

    // Merge with defaults so newly added fields always have a fallback value.
    const parsed = JSON.parse(raw) as Partial<WorkboxSettings> & {
      forceOnlyPages?: boolean;
    };
    return {
      ...DEFAULT_WORKBOX_SETTINGS,
      ...parsed,
      scopeIds: toStringArray(parsed.scopeIds),
      languages: toStringArray(parsed.languages),
      workflowIds: toStringArray(parsed.workflowIds),
      pageDisplay: parsePageDisplay(parsed),
      previewDomain:
        typeof parsed.previewDomain === "string" ? parsed.previewDomain : "",
    };
  } catch {
    return { ...DEFAULT_WORKBOX_SETTINGS };
  }
}

/** Ensures a folder item exists, creating it under `parentId` if missing. */
async function ensureFolder(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  parentId: string,
  name: string,
) {
  const existing = await queryItemByPath(
    client,
    sitecoreContextId,
    path,
    DEFAULT_LANGUAGE,
  );
  if (existing) return existing;

  const created = await createItem(
    client,
    sitecoreContextId,
    parentId,
    SITECORE_TEMPLATES.MODULE_FOLDER,
    name,
    DEFAULT_LANGUAGE,
  );
  if (!created) throw new Error(`Failed to create the ${name} folder`);
  return created;
}

/**
 * Writes the settings, creating the folder chain and the Settings item on first
 * save. Throws when the user cannot write under `/sitecore/system/Modules` —
 * the caller surfaces that as a toast.
 */
export async function saveWorkboxSettings(
  client: ClientSDK,
  sitecoreContextId: string,
  settings: WorkboxSettings,
): Promise<WorkboxSettings> {
  const marketplaceFolder = await ensureFolder(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.MARKETPLACE_FOLDER,
    MODULES_PARENT_ID,
    MARKETPLACE_FOLDER_NAME,
  );
  const moduleFolder = await ensureFolder(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.MODULE_FOLDER,
    marketplaceFolder.itemId,
    MODULE_FOLDER_NAME,
  );

  let settingsItem = await queryItemByPath(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.SETTINGS_ITEM,
    DEFAULT_LANGUAGE,
  );
  if (!settingsItem) {
    settingsItem = await createItem(
      client,
      sitecoreContextId,
      moduleFolder.itemId,
      SITECORE_TEMPLATES.SETTINGS_ITEM,
      SETTINGS_ITEM_NAME,
      DEFAULT_LANGUAGE,
    );
    if (!settingsItem) throw new Error("Failed to create the Settings item");
  }

  const value: WorkboxSettings = {
    ...settings,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  await updateItemField(
    client,
    sitecoreContextId,
    settingsItem.itemId,
    SETTINGS_PATHS.SETTINGS_ITEM,
    "Value",
    JSON.stringify(value),
    DEFAULT_LANGUAGE,
  );

  return value;
}
