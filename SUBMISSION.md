# Marketplace submission: Workbox

Copy-paste text for Sitecore's public-app submission form, in form order.
Replace every `{{...}}` placeholder before submitting.

## 1. App name

Workbox

## 2. Headline

<!-- 376 chars -->

Bring the classic Sitecore Workbox back to SitecoreAI. See every item waiting in workflow, grouped by workflow and state with live counts, filter to your own items or to pages, and run Submit, Approve, Reject or any workflow command on one item or a whole selection, with pages grouped with their data sources and optional automatic publish to Experience Edge on final states.

## 3. Description

SitecoreAI has no Workbox. Pages shows workflow only for the page you happen to have open, so an approver has no way to answer "what is waiting for me in this environment?". Workbox answers that from a single Full Screen view for editors and approvers, and adds bulk actions and filters on top.

Key features:
- Workflow and state tabs with live counts, in the order the workflow defines; final states hidden unless turned on
- Item list per state with display name, path, template, language, version, last updated and by whom, paged 10, 25, 50 or 100 rows
- Workflow commands taken from the state itself (Submit, Approve, Reject or whatever your workflow defines), on one row or a selection
- Bulk execution: commands run item by item, and a refused command never aborts the rest of the batch
- Pages and data sources: data sources are grouped under the page that owns or references them, and a command on a page can also run on the page's own data sources
- Filters: scope (site root or all content), language, name/path text, Only my items and Show only pages
- Details drawer with the version's field values and copy item ID / copy path buttons
- View Live and Preview links for page items
- Optional automatic smart publish to Experience Edge when a command moves items into a final state
- Admin settings to limit sites, languages and workflows, hide toolbar controls, force Only my items and choose how pages and data sources are shown

Use cases:
- Approvers clear their review queue in one place
- Editors submit a page together with its local data sources
- Teams check what is still stuck in workflow before a release

Every call runs with the signed-in user's own SitecoreAI permissions; the app needs no credentials.

## 4. Financial model

Free

## 5. Categories

Suggested (match to the portal's category list before submitting):
- Workflow
- Content management

## 6. Screenshots to capture

PNG, shown as 600×900 thumbnails. Capture during live QA on an environment with items in several workflow states.

1. Workflow and state tabs with counts and an item list, pages grouped with their data sources.
2. A bulk selection with the command buttons, and the comment dialog with the per-item result list.
3. Details drawer for an item (fields, copy ID / copy path).
4. Toolbar filters in use (scope, language, Only my items).
5. Admin settings page.
6. Scan progress or the "partial results" warning on a large scope (optional).

## 7. Links

- Website: https://github.com/robertobarbedo/sitecoreai-marketplace-workbox
- Support: https://github.com/robertobarbedo/sitecoreai-marketplace-workbox/issues
- Privacy policy: https://github.com/robertobarbedo/sitecoreai-marketplace-workbox/blob/main/PRIVACY.md
- Terms of service: https://github.com/robertobarbedo/sitecoreai-marketplace-workbox/blob/main/TERMS.md

## 8. Data usage disclosure

Paste from `DATA-USAGE.md` (replace `rb205@proton.me` in it first).

Summary: the app is client-side only. Content and workflow data travel only between the browser and the SitecoreAI host through the Marketplace SDK, with the user's own permissions, and nothing reaches the app's server. Workflow comments are stored by Sitecore in the item's workflow history, admin settings in one item in the customer's content tree, and view preferences in the browser's localStorage; the hosting provider keeps request logs for at most 90 days.

## 9. AI usage disclosure switch

Off. The app does not use AI or machine learning.

## 10. Configuration tab

- Extension point: **Full Screen**, route `/`.
- API access: **SitecoreAI APIs** (the app calls `xmc.authoring.graphql` and `xmc.xmapp.listSites` through the Marketplace SDK, plus `application.context` and `host.user`).
- Permissions: **Copy and Read from Clipboard** (the "Copy item ID" and "Copy path" buttons use `navigator.clipboard.writeText`). No file downloads. Note: View Live / Preview links open with `target="_blank"`; if they don't open in the portal iframe during QA, also enable **Pop-ups**.
- Deployment URL: `{{APP_URL}}`
- Client credentials (custom authorization): **No**. The app has no `/api` routes and uses only the Marketplace SDK's built-in authorization.
- Environment variables on the host: none required. Optional: `CSP_FRAME_ANCESTORS`.
- App logo: `public/icon.svg`

## 11. Submission details (visible only to Sitecore)

- Contact name: `Roberto Barbedo`
- Contact email: `rb205@proton.me`

**App functionality**

Workbox is a client-side Next.js 15 app on the Full Screen extension point, with built-in Marketplace authorization only; there are no API routes and the server serves only the static app. It acts on the environment it was opened from (`application.context`). Because the Authoring API has no "items in this workflow state" query, it enumerates items under the selected scope with the `search` query on `sitecore_master_index` (200 per page, stoppable, capped at 5,000 items) and resolves each item's workflow state live from the item. Commands are read from the workflow definition and run with `executeWorkflowCommand`; optional automatic publish uses `publishItem` (Smart, to Experience Edge). Sites come from `xmc.xmapp.listSites`, the user's email from `host.user`. Admin settings are stored as JSON at `/sitecore/system/Modules/Marketplace/Workbox/Settings` in the customer's environment; per-user view preferences in localStorage.

**Business value / alignment with Sitecore standards**

The app restores a central review queue that classic Sitecore users rely on and that SitecoreAI lacks, and adds bulk commands and page/data-source grouping that reduce approval time. It uses only supported Marketplace SDK APIs (`xmc.authoring.graphql`, `xmc.xmapp.listSites`, `application.context`, `host.user`), and every read, command and publish runs with the signed-in user's own permissions, so it can do nothing the user couldn't do in SitecoreAI. The UI follows the Blok design language (Tailwind CSS v4, Radix UI). Security measures: no secrets, credentials or API routes; all interpolated GraphQL values are escaped; security headers on every response (HSTS, CSP frame-ancestors limited to SitecoreAI, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Fonts are bundled at build time; no analytics or third-party requests.

**Licensing note**

Next.js lists sharp (LGPL-3.0 libvips) as an optional dependency for image optimization; this app doesn't use next/image and sets images.unoptimized, so sharp is never loaded. lightningcss (MPL-2.0) is a build-time-only dependency of Tailwind CSS and is not shipped.

## 12. Pre-submit checklist

- [ ] Live QA after the SDK 0.4 bump (CLAUDE.md): `xmc.xmapp.listSites` (deprecated) still returns root paths and hosts; `xmc.authoring.graphql` responses parse; `application.context` environment label and `host.user` email ("Only my items") work
- [ ] Live QA of the three GraphQL shapes CLAUDE.md marks unverified, on a non-production environment: `workflow(where:)` states/commands, `search ... innerItem { workflow { workflowState } }`, and `executeWorkflowCommand` (test on one throwaway item before bulk)
- [ ] Live QA: scan, single and bulk commands with and without comments, page + data source cascade
- [ ] Live QA: automatic publish on final states; View Live / Preview links; copy ID / path with clipboard permission enabled
- [ ] Live QA: admin settings save and restrict the toolbar
- [ ] Clipboard permission selected in App Studio
- [ ] Screenshots captured (PNG)
- [ ] `rb205@proton.me` replaced in DATA-USAGE.md, PRIVACY.md, TERMS.md, SECURITY.md; `Roberto Barbedo`, `rb205@proton.me`, `{{APP_URL}}` replaced in this form
