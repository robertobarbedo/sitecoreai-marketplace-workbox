/** Display helpers for Sitecore field values. */

const SITECORE_DATE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/;

/**
 * Sitecore stores dates as ISO 8601 basic (`20260727T134500Z`), which `Date`
 * cannot parse. Also tolerates real ISO strings.
 */
export function parseSitecoreDate(value: string): Date | null {
  if (!value) return null;

  const match = SITECORE_DATE.exec(value);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    const parsed = new Date(
      Date.UTC(+y, +mo - 1, +d, +h, +mi, +s),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Renders a Sitecore date, or an em dash for unset / year-1 values. */
export function formatDate(value: string): string {
  const date = parseSitecoreDate(value);
  if (!date || date.getUTCFullYear() <= 1) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `sitecore\jane@example.com` → `jane@example.com`. */
export function formatUser(value: string): string {
  if (!value) return "—";
  const slash = value.lastIndexOf("\\");
  return slash >= 0 ? value.slice(slash + 1) : value;
}

/**
 * Comparison key for Sitecore GUIDs. The workflow definition query and the item
 * itself may report the same id in different shapes (`{ABC-…}` vs `abc…`), so
 * ids are always matched through this rather than compared directly.
 */
export function idKey(id: string): string {
  return id.replace(/[{}-]/g, "").toLowerCase();
}

/** Last path segment, used when an item has no display name yet. */
export function lastPathSegment(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
