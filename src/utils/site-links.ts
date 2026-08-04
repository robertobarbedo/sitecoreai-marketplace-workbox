import type { WorkboxItem } from "@/src/types/workbox";
import { idKey } from "@/src/utils/format";
import type { SiteInfo } from "@/src/utils/sitecore-graphql";

const HORIZON_HOST = "https://pages.sitecorecloud.io";

/** Any GUID shape → dashed lowercase (`fac87f27-6a93-...`), as preview wants. */
function toDashedGuid(id: string): string {
  const key = idKey(id);
  if (key.length !== 32) return id;
  return `${key.slice(0, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}-${key.slice(16, 20)}-${key.slice(20)}`;
}

export interface ItemLinks {
  live?: string;
  preview?: string;
}

/** `https://x/`, trailing slashes, whitespace → bare hostname. */
function cleanDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

/**
 * Public URL path of an item within its site: strips the site root and start
 * item off the content path and prepends the language when the site embeds it.
 */
function routeFor(item: WorkboxItem, site: SiteInfo): string {
  let route = item.path.slice(site.rootPath.length);
  const startItem = site.startItem || "/Home";
  if (route.toLowerCase().startsWith(startItem.toLowerCase())) {
    route = route.slice(startItem.length);
  }
  if (route === "/") route = "";
  const locale = site.languageEmbedding
    ? `/${item.language.toLowerCase()}`
    : "";
  return `${locale}${route}` || "/";
}

/**
 * Row links for a page item. "View live" comes off the site's configured live
 * hostname. The preview link targets the CM host with the Pages preview
 * parameters — the CM host is derived from the site's thumbnail URL, with the
 * manually configured CM URL setting as override/fallback. Non-page items get
 * no links.
 */
export function buildItemLinks(
  item: WorkboxItem,
  sites: SiteInfo[],
  previewDomain: string,
): ItemLinks {
  if (!item.hasLayout) return {};

  const lowerPath = item.path.toLowerCase();
  const site = sites
    .filter((candidate) => {
      const root = candidate.rootPath.toLowerCase();
      return root && (lowerPath === root || lowerPath.startsWith(`${root}/`));
    })
    .sort((a, b) => b.rootPath.length - a.rootPath.length)[0];
  if (!site) return {};

  const route = routeFor(item, site);
  const links: ItemLinks = {};
  if (site.targetHostname) {
    links.live = `https://${site.targetHostname}${route === "/" ? "" : route}`;
  }

  // A dedicated preview head serves the same route as live on its own domain;
  // without one, preview goes through the CM host's Pages preview mode.
  const dedicated = cleanDomain(previewDomain);
  if (dedicated) {
    links.preview = `https://${dedicated}${route === "/" ? "" : route}`;
  } else if (site.cmHost) {
    const params = new URLSearchParams({
      sc_horizon: "preview",
      sc_headless_mode: "preview",
      sc_itemid: toDashedGuid(item.itemId),
      sc_lang: item.language,
      sc_site: site.name,
      sc_horizonhost: HORIZON_HOST,
    });
    links.preview = `https://${site.cmHost}/?${params.toString()}`;
  }
  return links;
}
