import { PREFS_STORAGE_KEY } from "@/src/constants";
import type { WorkboxPrefs } from "@/src/types/workbox";

/**
 * View preferences live in localStorage rather than the content tree (where the
 * sibling apps keep their settings): scope / language / page size are per-user
 * view state, and Workbox users are editors who may not be able to write under
 * `/sitecore/system/Modules`.
 */
export function loadPrefs(): WorkboxPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WorkboxPrefs;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function savePrefs(prefs: WorkboxPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage disabled / full — preferences just don't persist.
  }
}
