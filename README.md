# Workbox for SitecoreAI

A SitecoreAI Marketplace **Full Screen** app that brings back the classic
Sitecore Workbox: see every item waiting in workflow in the environment, grouped
by workflow and state, and run workflow commands on one item or a whole batch.

SitecoreAI has no Workbox. Pages shows workflow only for the page you happen to
have open, so an approver has no way to answer "what is waiting for me in this
environment?". This app answers that question, and adds the parts editors always
wanted: bulk actions, an "only my items" filter, an item details drawer, and an
optional publish once an item reaches a final state.

Built on the [Sitecore Authoring and Management GraphQL API](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/sitecore-authoring-and-management-graphql-api/index-en.html)
through the Marketplace SDK.

## Features

- **Workflow → state tabs with live counts**, ordered as the workflow defines
  them. Final states are hidden by default and shown with a toggle.
- **Item list** per state: display name, path, template, language + version,
  last updated and by whom.
- **Workflow commands** taken from the state itself (Submit / Approve / Reject
  or whatever your workflow defines), with an optional comment.
- **Bulk execution** — select rows, run one command across all of them, and get
  a per-item success/failure list. Failures never abort the rest of the batch.
- **Scope, language and text filters**, plus "Only my items".
- **Details drawer** with the version's own field values and copy item-ID / path
  actions.
- **Publish prompt** when a command moves items into a final state — reaching a
  final workflow state is not the same as being published.

## How authentication works

There is none to configure. The app runs inside the SitecoreAI iframe and every
call goes through the Marketplace SDK
(`ClientSDK.init({ target: window.parent, modules: [XMC] })`), which proxies
authoring GraphQL using the signed-in user's own permissions. There are no API
routes, no OAuth client credentials and no secrets in this app.

Because Full Screen extensions are installed **per environment**, the app always
acts on the environment it was opened from
(`application.context → resourceAccess[0]`).

## How items are found

The Authoring API has no "list the items in this workflow state" query, so the
app enumerates items under the selected scope through the `search` query
(`sitecore_master_index`) and reads each result's workflow state off the item
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

The index is only used to enumerate items — the workflow state comes from the
item, so results are never stale relative to the index's copy of
`__Workflow state`, and the app does not depend on that field's index name.

The trade-off is cost: a scan reads every item under the scope. It therefore
defaults to a **single site root**, pages 200 items at a time, reports progress,
can be stopped, and stops itself after 5,000 items with a "partial results"
warning telling you to narrow the scope.

Workflow state is a **versioned** field, so v1 and v2 of the same item can sit in
different states and are listed as separate rows — the same as classic Workbox.

## Getting started

```bash
npm install
npm run dev
```

> **This app cannot be tested standalone.** The Marketplace SDK requires the
> SitecoreAI iframe; outside it, initialization fails and the page shows the
> "Could not connect to SitecoreAI" panel. `npm run build` is the only local
> verification — real testing happens in a registered environment.

Expose the dev server over HTTPS (e.g. `ngrok http 5011`) or deploy it (Vercel)
to get a public URL.

## Register the app in SitecoreAI

1. Cloud Portal → **App Studio → Create App**.
2. Type `Custom`.
3. Extension Points: **Full Screen**.
4. API Access: **SitecoreAI APIs**.
5. Permissions: **Copy and Read from Clipboard** (needed by the "Copy item ID" /
   "Copy path" buttons).
6. Deployment URL: your public origin — the app is served from the root route
   `/`.
7. App logo: `/icon.svg`.
8. **My apps → Install** into the target environment, then open it from the
   environment's app menu.

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Shared GA4 measurement ID for all Marketplace apps. Leave empty to disable analytics. |

Scope, language, page size and the two toggles are per-user view preferences and
are stored in `localStorage`, not in the content tree.

## Limitations

- **Scope-bound.** The app lists what is in workflow under the selected scope,
  not the whole database. Scans stop at 5,000 items.
- **No workflow history.** The Authoring API exposes no comment trail, so past
  comments are not shown — only new ones can be added when running a command.
- **No version diff.**
- **No deep links.** `application.context` carries no environment host URL, so
  the app cannot link an item into Pages or Explorer; copy the item ID or path
  instead.
- **"Only my items" is a heuristic.** XM Cloud usernames are federated and
  prefixed, so the filter matches the signed-in user's email as a substring of
  `__Updated by`.
