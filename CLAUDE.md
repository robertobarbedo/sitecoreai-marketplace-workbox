# Workbox — notes for Claude Code

## Do NOT run or test this app standalone

SitecoreAI Marketplace apps **cannot run as standalone web apps**. The
Marketplace SDK (`ClientSDK.init({ target: window.parent })`) requires the app to
be embedded in an iframe inside SitecoreAI — outside of it, initialization
hangs/fails and the page is non-functional.

Therefore: **do not start the dev server, open the app in a browser, or attempt
runtime testing.** Verification is limited to:

- `npm run build` (type-check + lint + compile) must pass.
- Manual testing happens only inside SitecoreAI after the app is registered in
  App Studio (**Full Screen** extension point → the root route `/`).

A stray `next dev -p 5011` holding `.next` will make `npm run build` hang (EPERM
on `.next/trace`) — kill it before building.

## What it does

Classic Sitecore Workbox, rebuilt on the Authoring & Management GraphQL API:
workflow → state tabs with counts → item list → run a workflow command (single
or bulk). Plus bulk actions, an "only my items" filter and a details drawer.
The comment dialog only appears for commands whose item has
`Suppress Comment` = "1" (the mapping the user asked for — NOTE: classic
Sitecore semantics are the inverse); other commands run immediately with an
empty comment. When items reach a final state they are auto-published to
Experience Edge if the `autoPublish` admin setting is on (default) — there is
no publish prompt either way.

**Full Screen** extension point, so it is installed per environment and always
acts on the environment it was opened from —
`getEnvironmentContext()` takes `resourceAccess[0]`, matching the
`experience-edge-admin-console` convention (the standalone apps, by contrast,
list every tenant and let the user pick).

## The core design constraint

The Authoring API has **no "items in workflow state" query**. So:

- `scanWorkflowItems` (`src/utils/sitecore-graphql.ts`) enumerates items under a
  scope with the `search` query on `sitecore_master_index`, filtered only by
  `_path` (the scope item id, 32 chars no dashes) and `_language`.
- The **workflow state is read off `innerItem`**, i.e. resolved live from the
  item, never from an index field. This is deliberate: the index field name for
  `__Workflow state` (`__workflow state` vs `__workflow_state`) cannot be relied
  on across environments, and index staleness would produce wrong buckets.
- Row data (name, displayName, template, `__Updated`, `__Updated by`) comes back
  on the **same** request. An earlier design deferred it to a per-page
  enrichment query; that was dropped because "Only my items" and the text filter
  must apply to the whole result set, not the visible page.
- `runScan` (`src/utils/scan.ts`) pages this until `totalCount` is reached or
  `SCAN_MAX_PAGES` trips, honouring a cancel flag between pages.

If this ever needs to get faster on large trees, the additive change is a
`__workflow state` criterion in the search behind a settings toggle — but the
field name has to be confirmed against a live environment first.

## GraphQL shapes that are NOT verified against a live environment

`npm run build` cannot type-check GraphQL. Three shapes came from Sitecore docs
and community sources and **must be validated in a non-production environment
before this app is trusted**. Each is isolated in one function so a correction is
local:

1. `workflow(where: { workflowId })` with `states` / `commands(query: { stateId })`
   — `getWorkflow` / `getStateCommands`. If this fails the app degrades rather
   than breaks: `effectiveWorkflows` in `page.tsx` widens the definition list
   with the workflow and state every scanned item reports, so the tabs still
   render — only the command buttons go missing.
2. `search { results { innerItem { workflow { workflowState { final } } } } }`
   — `scanWorkflowItems`. This is the whole discovery mechanism. If `innerItem`
   won't resolve `workflow`, the fallback is a per-item query for each candidate.
3. `executeWorkflowCommand(input: { item, commandId, comments })` taking an
   `ItemQueryInput` with `database`/`itemId`/`language`/`version` and returning
   `successful` / `completed` / `message` / `error` / `nextStateId`
   — `executeWorkflowCommand`. **Test on a single throwaway item before using
   bulk.**

`getItemFull` also passes `version` inside `item(where:)`; the same
`ItemQueryInput` assumption applies.

## Invariants worth keeping

- All authoring calls go through `runAuthoring` (`sitecore-graphql.ts`), which
  throws on `errors[]` and on an empty `data`. Queries are string-interpolated —
  the SDK passthrough takes no GraphQL variables — so every interpolated value
  goes through `escapeGraphQL` first. Exception: the scan's search uses
  `runAuthoringPartial`, which keeps the data when field-level errors are
  present — the index can hold documents whose `innerItem` no longer resolves
  (no version in the requested language ⇒ "'{00000000-...}' template doesn't
  exist" per broken result) and those must be skipped, not fail the page. The
  scope path→id lookup in `runScan` always runs in `DEFAULT_LANGUAGE` for the
  same reason.
- `executeWorkflowCommand` **resolves** on a refused command instead of throwing;
  a bulk run reports every item's outcome and must not abort on the first
  failure. `confirmRun` in `page.tsx` runs items **sequentially** on purpose:
  workflow commands fire actions that can cascade.
- GUIDs arrive in different shapes from different sources (`{ABC-…}` vs `abc…`).
  Never compare ids directly — use `idKey()` (`src/utils/format.ts`). Scan
  buckets are keyed by `idKey` at both levels.
- Item identity for selection is `itemId|language|version` (`WorkboxItem.key`).
  Workflow state is a versioned field, so two versions of one item are two rows.
- The sites list needs the **live** context id (`context.live`); authoring
  GraphQL needs the **preview** one. Do not mix them.
- `formatDate` renders unset / year-1 dates as `—`; `__Updated` is Sitecore ISO
  basic (`20260727T134500Z`), which `Date` cannot parse — `parseSitecoreDate`
  handles it.

## Two settings stores — do not merge them

- **Per-user view prefs** stay in `localStorage` (`src/utils/prefs.ts`): scope /
  language / page size / toggles are per-user view state, and Workbox users are
  editors who may not have write access under `/sitecore/system`.
- **Admin settings** (`src/utils/settings.ts`, gear button → `SettingsPage`)
  follow the sibling apps' convention: JSON in the `Value` field of
  `/sitecore/system/Modules/Marketplace/Workbox/Settings`, folders created on
  first save. They restrict what the UI offers: `scopeIds` / `languages` /
  `workflowIds` (empty = all; exactly one = fixed and the input is hidden,
  rendered as a disabled select; several = input lists only those; a selection
  that matches nothing falls back to all) plus visibility toggles for the Rows
  selector, "Only my items" and "Show final states" (hidden controls fall back
  to defaults via the `effective*` values in `page.tsx`). `pageDisplay`
  (`grouped` default / `pagesOnly` / `flat`; legacy `forceOnlyPages` migrates
  on load) controls the pages-vs-data-sources view, and
  `commandsIncludeDatasources` (default true; active in `grouped` and
  `pagesOnly` modes, hidden+off in `flat`) makes a command on a page cascade to
  its data sources — data sources first, page last (`openRun` expands the
  target list via `src/utils/grouping.ts` BEFORE the dialog, so the dialog
  count includes them). Two different datasource definitions, both same-state
  same-language: the grouped VIEW nests items under `<page path>/data/` OR
  referenced by the page's layout XML `ds="..."` attributes (GUID / absolute
  path / SXA `local:/...`, parsed into `WorkboxItem.datasourceRefs` during the
  scan); the command CASCADE deliberately uses only the page-local
  `<page path>/data/` items, never shared ones — a shared data source may be
  used by other pages. Loading is best-effort — read failures mean
  defaults; saving throws and surfaces a toast for editors without write
  access.

## Architecture

- Next.js 15 App Router, React 19, TS strict. Single client page at `/`
  (`src/app/page.tsx`). No `/api/*` routes, no OAuth, no secrets.
- Tailwind v4 + Blok tokens in `src/app/globals.css` (copied from
  `workflow-center`); UI primitives in `components/ui/*` copied from
  `content-transfer-api-console`, except `checkbox.tsx` which is a native input
  (a table page renders hundreds of them).
- Styling follows `C:\Marketplace\STYLE-GUIDE.md`.
- Dev port 5011.

## Reference apps

All sibling folders under `C:\Marketplace` are reference material only — never
modify them.
