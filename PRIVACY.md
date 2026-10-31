# Privacy Policy

**Last updated: 2026-10-31**

## Overview

This policy explains what data Workbox ("the app") handles, where it goes,
what is stored, and how you can exercise your rights. It applies to the
hosted app listed in the Sitecore Marketplace.

## Summary

- The app runs entirely in your browser. It has no API routes, no database
  and no server-side logic of its own, and it stores no Sitecore content,
  item data or credentials on its servers.
- The app uses no analytics, tracking or advertising services.
- Workflow commands, comments, publishes and admin settings are written to
  your own SitecoreAI environment, with your own SitecoreAI permissions.
- Your view preferences stay in your browser's `localStorage`.
- The only data the publisher's hosting sees is the standard request
  metadata recorded when your browser downloads the app's pages and files.

## How the app works

The app runs inside SitecoreAI as a Full Screen app. Everything it does goes
through the Sitecore Marketplace SDK, which the SitecoreAI host turns into
requests to your environment, made with your own SitecoreAI permissions:

- Sitecore Authoring and Management GraphQL API (item search, workflow
  definitions, workflow commands, publishing, admin settings)
- The sites list of your environment
- The signed-in user's profile (`host.user`), for your email address

The results are processed in your browser and are never sent to the app's
servers.

## What data the app handles

- **Sitecore content and metadata** (item names, display names, paths, IDs,
  templates, languages, versions, field values shown in the details drawer,
  layout data, workflow state, `__Updated` and `__Updated by`, site names and
  host names): read from your environment and shown in your browser only.
- **Your email address**: read from the SitecoreAI host and used in the
  browser to match `__Updated by` for the "Only my items" filter. It is not
  stored or sent anywhere.
- **Workflow command comments**: text you type when a command asks for a
  comment. It is sent to your environment with the command, and Sitecore
  stores it in the item's workflow history, together with your user name and
  the time.
- **Admin settings** (allowed sites, languages and workflows, toolbar
  visibility, page display mode, a dedicated Preview URL, automatic publish):
  entered by an administrator and saved in your environment.
- **View preferences** (selected scope, language, rows per page and toolbar
  toggles): kept in your browser.
- **Clipboard**: the "Copy item ID" and "Copy path" buttons write to your
  clipboard. The app never reads from it.

## Where data goes

1. **Sitecore.** All queries and changes go through the Marketplace SDK to
   your SitecoreAI environment. Running a workflow command executes it on the
   item as you, with your comment; Sitecore records it in the item's workflow
   history and runs any actions the workflow defines. When automatic
   publishing is on, items that reach a final state are published to
   Experience Edge.
2. **The app's hosting provider.** Your browser downloads the app's pages,
   scripts, styles and fonts from the app's deployment. Fonts are bundled
   with the app, so no request goes to Google or any other font service.

The app does not sell or share data with anyone else.

## What is stored and where

| Data | Where | Retention |
| --- | --- | --- |
| Workflow command results and comments (workflow history entries: item, old and new state, comment, user, time) | Your SitecoreAI environment, written by Sitecore | Governed by your Sitecore agreement and environment |
| Admin settings (JSON) | Your SitecoreAI environment, item `/sitecore/system/Modules/Marketplace/Workbox/Settings` | Until the item is deleted |
| View preferences (`sitecoreai-workbox-prefs`: scope ID, language, rows per page, "Show final states", "Only my items", "Show only pages") | Your browser's `localStorage` | Until you clear site data for the app |
| Standard request metadata recorded by the hosting provider (IP address, time, path, user agent) | Vercel | 90 days at most |

The app has no server log of its own: it has no API routes, so no content,
tokens, secrets or user identifiers reach the app's servers.

## Who can access it

- **Data in your SitecoreAI environment** (workflow history, admin settings,
  published content): governed by your SitecoreAI permissions and your
  agreement with Sitecore. Workflow history is visible to anyone who can see
  the item's history in SitecoreAI; admin settings are shared by everyone who
  uses the app in that environment.
- **Browser storage:** only you, on your own device.
- **Hosting request metadata:** only the app's maintainer, for operating and
  securing the app, and the hosting provider as a sub-processor.

## How data is protected

- All traffic uses HTTPS (TLS 1.2 or later) with HSTS.
- The app never handles credentials: the SitecoreAI host attaches your token
  to each request, and the app can do nothing you could not do in SitecoreAI
  yourself.
- Values placed in GraphQL queries are escaped before they are sent.
- Security headers restrict which sites may embed the app.
- Data in your environment is protected by Sitecore under your agreement.

## Local storage

The app keeps one `localStorage` entry, `sitecoreai-workbox-prefs`, holding
your view preferences (selected scope ID, language, rows per page and the
"Show final states", "Only my items" and "Show only pages" toggles). It
contains no content and no personal data, stays on your device and is never
sent anywhere. You can clear it by clearing your browser data for the app.

## Sub-processors and third parties

- **Vercel Inc.** (hosting of the app's pages and files). Serverless
  functions run in the United States (region `iad1`, Washington, D.C.) unless
  a deployment sets another region; this app serves static files and has no
  server functions of its own. See https://vercel.com/legal/privacy-policy.
- **Sitecore** (SitecoreAI host and APIs), under your own agreement with
  Sitecore.

No analytics, tracking or advertising services are used.

## Your rights

Depending on where you live (for example under the GDPR or CCPA), you may
have the right to access, correct, delete, restrict or object to the
processing of your personal data, and to receive a copy of it.

To make a request, email rb205@proton.me with the subject "Data request".
We answer within 30 days. The publisher holds no personal data beyond the
hosting provider's request metadata described above. Data in your SitecoreAI
environment, including workflow comments and history, is held by your
organization under its agreement with Sitecore: contact your SitecoreAI
administrator or Sitecore for it. You can also complain to your local data
protection authority.

## Deletion

- **Browser data** is deleted when you clear site data for the app.
- **Admin settings** are deleted by deleting the
  `/sitecore/system/Modules/Marketplace/Workbox` folder in your environment.
  Uninstalling the app does not remove it.
- **Workflow history and comments** belong to your items in your environment
  and are managed there; the app cannot delete them.
- **Hosting request metadata** is deleted automatically by the hosting
  provider, within 90 days.

## Changes to this policy

We may update this policy from time to time. Changes are published in this
file and reflected in the "Last updated" date at the top.

## Contact

Questions about this policy: email rb205@proton.me or open an issue at
https://github.com/robertobarbedo/sitecoreai-marketplace-workbox/issues.
