# Workbox

A SitecoreAI Marketplace app that brings back the classic Sitecore Workbox for
editors and approvers: every item waiting in workflow, grouped by workflow and
state, with workflow commands for one item or a whole batch.

SitecoreAI (XM Cloud) has no Workbox. Pages shows workflow only for the page
you happen to have open, so an approver has no way to answer "what is waiting
for me in this environment?". This app answers that question from a single
Full Screen view, and adds what editors always wanted on top: bulk actions,
an "Only my items" filter, pages grouped with their data sources, an item
details drawer, live and preview links, and an optional automatic publish to
Experience Edge once items reach a final state.

## Features

- **Workflow and state tabs with live counts** — states are ordered as the
  workflow defines them; final states are hidden unless "Show final states" is
  on.
- **Item list per state** — display name, path, template, language and
  version, last updated and by whom, with paging (10 / 25 / 50 / 100 rows).
- **Workflow commands from the state itself** — Submit, Approve, Reject or
  whatever your workflow defines, on a single row or on a selection.
- **Bulk execution** — run one command across every selected row; items run
  one after another and a refused command never aborts the rest of the batch.
  Moved rows are grayed out in place until the next scan.
- **Pages and data sources** — by default data sources are grouped under the
  page that owns or references them, and a command on a page also runs on the
  page's own data sources (data sources first, page last).
- **Filters** — scope (site root or all content), language (or all
  languages), a name/path text filter, "Only my items" and "Show only pages".
- **Details drawer** — the version's own field values, plus copy item ID and
  copy path buttons.
- **View Live and Preview links** for page items, built from the site's
  configuration.
- **Automatic publish** — items that a command moves into a final state are
  smart-published to Experience Edge (can be turned off in settings).
- **Admin settings** — limit the sites, languages and workflows on offer, hide
  toolbar controls, force "Only my items", and choose how pages and data
  sources are displayed.

## How it works

- **Extension point:** Full Screen, served from the root route `/`. Full Screen
  apps are installed per environment, so the app always acts on the
  environment it was opened from (the first entry of `resourceAccess` in the
  Marketplace `application.context`).
- **APIs:** everything goes through the Marketplace SDK
  (`@sitecore-marketplace-sdk/client` with the `xmc` module), which proxies the
  [Sitecore Authoring and Management GraphQL API](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/sitecore-authoring-and-management-graphql-api/index-en.html)
  and the sites list (`xmc.xmapp.listSites`) using the signed-in user's own
  permissions. The signed-in user's email comes from the SDK's `host.user`
  query.
- **Data flow:** browser → Marketplace SDK → SitecoreAI host → Sitecore APIs.
  The app has no `/api` routes and no server-side logic of its own.

### How items are found

The Authoring API has no "list the items in this workflow state" query, so the
app enumerates every item under the selected scope through the `search` query
on `sitecore_master_index` and reads each result's workflow state off the item
itself:

```graphql
search(query: { index: "sitecore_master_index", searchStatement: { criteria: [
  { operator: MUST, field: "_path",     value: "<scope item id>" }
  { operator: MUST, field: "_language", value: "en" }
]}, paging: { pageSize: 200, pageIndex: 0 } }) {
  totalCount
  results { innerItem { itemId path version
    workflow { workflowState { stateId displayName final } } } }
}
```

(The real query also returns the name, template, `__Updated`, `__Updated by`
and layout fields in the same request; the `_language` criterion is dropped
when "All languages" is selected.)

The index is only used to enumerate items. The workflow state is resolved
live from the item, so results are never stale relative to the index's copy of
`__Workflow state`, and the app does not depend on that field's index name.
Index entries whose item no longer resolves are skipped rather than failing
the scan.

The trade-off is cost: a scan reads every item under the scope. It therefore
defaults to a single site root, pages 200 items at a time, reports progress,
can be stopped, and stops itself after 25 pages (5,000 items) with a "partial
results" warning telling you to narrow the scope.

Workflow state is a versioned field, so v1 and v2 of the same item can sit in
different states and are listed as separate rows, the same as classic
Workbox.

### Running commands

Commands for the current state are read from the workflow definition. If the
workflow definition cannot be read, the tabs are still built from the
workflow and state each scanned item reports; only the command buttons are
missing.

Whether a command asks for a comment is driven by its **Suppress Comment**
field: when it is set, a dialog lists the affected items and takes an optional
comment (and, for bulk runs, shows a per-item success/failure list); when it
is not set, the command runs immediately with an empty comment and reports
the outcome in a toast. Note this is the inverse of how classic Sitecore
treats the field.

When automatic publishing is on, every item a command moved into a final
state is smart-published to Experience Edge (one publish per item and
language, sub-items and related items off).

### Pages and data sources

An item with layout details (`__Renderings` or `__Final Renderings`) counts as
a page. In the grouped view a page's data sources are the items in the same
state and language that live under `<page path>/data/` or are referenced by
`ds="..."` attributes in the page's layout (GUID, absolute path or SXA
`local:/` path). The command cascade is deliberately narrower: it only
includes the page-local items under `<page path>/data/`, never shared data
sources that other pages may use.

## Requirements

- A SitecoreAI (XM Cloud) environment.
- Organization Admin (or equivalent) in the Cloud Portal to register and
  install the app.
- Users need read access to the content they want to see, and the workflow
  rights to execute the commands they run; publishing requires publish rights.
- Saving the admin settings requires write access under
  `/sitecore/system/Modules`.
- No extra credentials, API keys or third-party services.

## Install in SitecoreAI

1. Cloud Portal → **App Studio** → **Create App**.
2. App name: `Workbox`; Type: `Custom`.
3. Extension point: **Full Screen**, route `/`.
4. API access: **SitecoreAI APIs**.
5. Permissions: **Copy and Read from Clipboard** (used by the "Copy item ID"
   and "Copy path" buttons).
6. Deployment URL: `https://<your-deployment>/`.
7. App logo: [`public/icon.svg`](public/icon.svg).
8. No custom authorization is needed.
9. **My apps** → **Install** into the target environment, then open Workbox
   from the environment's app menu.

## Deploy your own instance

```bash
npm install
npm run build
npm start
```

Deploy to Vercel or any Node.js host, then use its public URL as the
Deployment URL in App Studio.

| Variable | Required | Description |
|---|---|---|
| `CSP_FRAME_ANCESTORS` | No | Space-separated CSP sources allowed to embed the app (`Content-Security-Policy: frame-ancestors`). Default: `'self' https://*.sitecorecloud.io`. |

The app only runs inside SitecoreAI: the Marketplace SDK needs the host
iframe, so opening the deployment directly in a browser shows a "Could not
connect to SitecoreAI" error. For local development, run `npm run dev`
(port 5011), expose it over HTTPS (for example `ngrok http 5011`) and register
that URL in a separate development app in App Studio.

## Configuration

**Admin settings** (gear button in the toolbar) are shared by everyone using
the app in the environment. They are stored as JSON in the `Value` field of
`/sitecore/system/Modules/Marketplace/Workbox/Settings`; the folders and item
are created on first save. If the item is missing or unreadable, defaults are
used.

| Setting | Default | Effect |
|---|---|---|
| Sites, Languages, Workflows | none selected | None = all offered; one = fixed and its input is hidden; several = only those offered. A selection that matches nothing falls back to all. |
| Rows per page selector, Only my items filter, Show final states toggle | shown, shown, hidden | Hidden controls fall back to their default behavior. |
| Pages display | Group data sources under their page | Alternatives: show only pages, or show pages and data sources as separate rows (adds a "Show only pages" switch). |
| Commands also run on data sources | on | Only in the grouped and pages-only modes. |
| Always show only the user's own items | off | Forces the "Only my items" filter and hides its switch. |
| Dedicated Preview URL | empty | When set, Preview links use this domain with the live path; otherwise they use the CM host's Pages preview mode. |
| Automatically publish when items reach a final state | on | Publishes to Experience Edge after a successful command. |

**Per-user view preferences** (scope, language, rows per page, and the
toolbar toggles) are stored in the browser's `localStorage`, not in the
content tree, so editors without write access under `/sitecore/system` keep
their own view.

## Security and privacy

- **Authentication:** none to configure. Every call goes through the
  Marketplace SDK with the signed-in user's own SitecoreAI permissions; the app
  cannot do anything that user could not do in SitecoreAI.
- **Secrets:** none. The app has no API routes, no OAuth client credentials
  and no stored keys.
- **Data:** content and workflow data travel only between the browser and the
  SitecoreAI host; nothing is sent to the app's own server. Admin settings are
  written to the content tree; view preferences stay in `localStorage`.
- **Workflow comments:** comments typed for a workflow command are sent to
  your environment with the command and stored by Sitecore in the item's
  workflow history, as with any workflow command run in SitecoreAI.
- **No analytics or tracking.** Fonts are bundled with the app at build time,
  so no request reaches Google or any other third party.
- **Host restrictions:** not applicable; the app makes no outbound requests of
  its own.
- **Security headers:** HSTS, `Content-Security-Policy: frame-ancestors`
  (only SitecoreAI may embed the app; see `CSP_FRAME_ANCESTORS`),
  `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.
- **Policies:** [Privacy policy](PRIVACY.md),
  [Terms of service](TERMS.md),
  [Data usage disclosure](DATA-USAGE.md) and
  [Security policy](SECURITY.md).

## Limitations

- **Scope-bound scans.** The app lists what is in workflow under the selected
  scope, not the whole database, and a scan stops at 5,000 items. Large trees
  are slow because every item under the scope is read.
- **Results are a snapshot.** After running commands, moved rows are grayed
  out but the list is not refreshed until you rescan.
- **No workflow history.** The Authoring API exposes no comment trail, so past
  comments are not shown; new ones can be added when a command asks for one.
- **No version diff.**
- **No deep links into Pages or Content Editor.** Items can be opened via View
  Live / Preview links (page items only, when the site has a hostname or a
  preview host can be derived), or by copying the item ID or path.
- **"Only my items" is a heuristic.** SitecoreAI usernames are federated and
  prefixed, so the filter matches the signed-in user's email as a substring of
  `__Updated by`. It is unavailable when the host reports no user email.
- **Automatic publish applies only to final states in the workflow
  definition**, and is not offered as a prompt; turn it off in settings to
  publish manually.

## Development

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI,
  Material Design Icons, Sitecore Marketplace SDK (`client` and `xmc`).
- `npm run dev` serves on port 5011; `npm run build` type-checks and compiles.
- Structure:
  - `src/app/` — the single Full Screen page and layout
  - `src/utils/` — GraphQL calls, scan, grouping, settings and preferences
  - `src/types/` — shared types
  - `components/workbox/` — app UI; `components/ui/` — UI primitives
  - `lib/` — shared helpers
  - `public/` — app icon

## Support

Report bugs and request features in
[GitHub Issues](https://github.com/robertobarbedo/sitecoreai-marketplace-workbox/issues).
Report security problems privately as described in the
[Security policy](SECURITY.md). See also the [Privacy policy](PRIVACY.md),
[Terms of service](TERMS.md) and [Data usage disclosure](DATA-USAGE.md).
This is a community app and is not an official Sitecore product.

## License

Licensed under the Apache License 2.0 — see [LICENSE](LICENSE).
