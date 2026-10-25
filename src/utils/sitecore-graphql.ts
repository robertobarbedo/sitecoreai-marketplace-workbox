import type { ClientSDK } from "@sitecore-marketplace-sdk/client";

import {
  ALL_LANGUAGES,
  DEFAULT_LANGUAGE,
  MASTER_DATABASE,
  SCAN_PAGE_SIZE,
  WORKFLOWS_ROOT,
} from "@/src/constants";
import type {
  CommandRunResult,
  ItemFieldValue,
  WorkboxItem,
  WorkboxItemFull,
  WorkflowCommand,
  WorkflowState,
  WorkflowSummary,
} from "@/src/types/workbox";

/**
 * Every authoring call in this app goes through `runAuthoring`. Queries are
 * string-interpolated (the workspace convention — the SDK passthrough takes no
 * GraphQL variables), so every interpolated value must go through
 * `escapeGraphQL` first.
 */
export function escapeGraphQL(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** `{ABC-...}` / `abc-...` → `abc...` (32 chars) — the form the search index wants. */
export function stripBraces(id: string): string {
  return id.replace(/[{}]/g, "").replace(/-/g, "");
}

type AuthoringResponse<T> = Record<string, unknown> & {
  data?: {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
};

export async function runAuthoring<T>(
  client: ClientSDK,
  sitecoreContextId: string,
  query: string,
): Promise<T> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: { query },
    },
  });

  const payload = (response as AuthoringResponse<T>).data;
  if (payload?.errors?.length) {
    throw new Error(
      payload.errors
        .map((e) => e.message ?? "Unknown GraphQL error")
        .join("; "),
    );
  }
  if (payload?.data === undefined || payload?.data === null) {
    throw new Error("Empty GraphQL response");
  }
  return payload.data;
}

/**
 * Like `runAuthoring`, but tolerates field-level errors as long as the response
 * carries data. The scan needs this: the search index can hold documents whose
 * `innerItem` no longer resolves (e.g. no version in the requested language —
 * surfaced as "'{00000000-...}' template doesn't exist" errors, one per broken
 * result). GraphQL still returns the resolvable results next to those errors,
 * so the right behavior is to keep the page and skip the null rows, not to
 * fail the whole scan.
 */
export async function runAuthoringPartial<T>(
  client: ClientSDK,
  sitecoreContextId: string,
  query: string,
): Promise<T> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: { query },
    },
  });

  const payload = (response as AuthoringResponse<T>).data;
  if (payload?.data !== undefined && payload?.data !== null) {
    return payload.data;
  }
  if (payload?.errors?.length) {
    throw new Error(
      payload.errors
        .map((e) => e.message ?? "Unknown GraphQL error")
        .join("; "),
    );
  }
  throw new Error("Empty GraphQL response");
}

/* ------------------------------------------------------------------ context */

export interface EnvironmentContext {
  /** Context id for the authoring GraphQL API (`context.preview`). */
  contextId: string;
  /** Context id the sites API wants (`context.live`) — NOT the authoring one. */
  liveContextId: string;
  label: string;
}

/**
 * Full Screen extensions are installed per environment, so the first (and
 * normally only) entry of `resourceAccess` is the environment the app was opened
 * from — same convention as the experience-edge-admin-console.
 */
export async function getEnvironmentContext(
  client: ClientSDK,
): Promise<EnvironmentContext | null> {
  const contextResponse = await client.query("application.context");
  const appContext = contextResponse.data as Record<string, unknown>;
  const resourceAccess = appContext?.resourceAccess as
    | Array<{
        tenantName?: string | null;
        tenantDisplayName?: string | null;
        context?: { preview?: string; live?: string };
      }>
    | undefined;

  const first = resourceAccess?.[0];
  if (!first?.context?.preview) return null;

  return {
    contextId: first.context.preview,
    liveContextId: first.context.live ?? "",
    label: first.tenantDisplayName || first.tenantName || "this environment",
  };
}

/** Signed-in user's email, used by the "Only my items" filter. */
export async function getHostUserEmail(client: ClientSDK): Promise<string> {
  try {
    const response = await client.query("host.user");
    const user = response.data as Record<string, unknown> | undefined;
    return typeof user?.email === "string" ? user.email : "";
  } catch {
    return "";
  }
}

export interface SiteInfo {
  name: string;
  rootPath: string;
  /** Live hostname (`hosts[].targetHostname`); empty when unset or a wildcard. */
  targetHostname: string;
  /** Site start item relative to the root, e.g. `/Home`. */
  startItem: string;
  /** Whether the site embeds the language in the URL (`/en-ca/...`). */
  languageEmbedding: boolean;
  /**
   * CM hostname (e.g. `xmc-....sitecorecloud.io`), extracted from the site
   * thumbnail URL — the only place the sites payload exposes it. Used to build
   * preview links; empty when no thumbnail is present.
   */
  cmHost: string;
}

/** Sites of the environment; the sites API needs the LIVE context id. */
export async function listSites(
  client: ClientSDK,
  liveContextId: string,
): Promise<SiteInfo[]> {
  if (!liveContextId) return [];

  const response = await client.query("xmc.xmapp.listSites", {
    params: { query: { sitecoreContextId: liveContextId } },
  });

  const sites = (
    response as {
      data?: {
        data?: Array<{
          name?: string;
          properties?: { rootPath?: string };
          thumbnail?: { url?: string };
          hosts?: Array<{
            targetHostname?: string;
            properties?: { startItem?: string };
            languageSettings?: { languageEmbedding?: boolean };
          }>;
        }>;
      };
    }
  ).data?.data;

  return (sites ?? [])
    .filter((site) => site.name && site.properties?.rootPath)
    .map((site) => {
      const host = site.hosts?.[0];
      const hostname = host?.targetHostname ?? "";

      let cmHost = "";
      try {
        const thumbnailUrl = site.thumbnail?.url;
        if (thumbnailUrl) cmHost = new URL(thumbnailUrl).host;
      } catch {
        // Unparsable thumbnail URL — preview links fall back to the setting.
      }

      return {
        name: site.name as string,
        rootPath: site.properties?.rootPath as string,
        targetHostname: hostname.includes("*") ? "" : hostname,
        startItem: host?.properties?.startItem || "/Home",
        languageEmbedding: Boolean(host?.languageSettings?.languageEmbedding),
        cmHost,
      };
    });
}

/** Language codes defined in the environment, e.g. `en`, `fr-CA`. */
export async function listLanguages(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<string[]> {
  const data = await runAuthoring<{
    item?: { children?: { nodes?: Array<{ name?: string }> } } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: {
          database: "${MASTER_DATABASE}"
          path: "/sitecore/system/Languages"
          language: "${DEFAULT_LANGUAGE}"
        }) {
          children { nodes { name } }
        }
      }
    `,
  );

  const names = (data.item?.children?.nodes ?? [])
    .map((node) => node.name)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names : [DEFAULT_LANGUAGE];
}

/* -------------------------------------------------------------------- items */

export interface SitecoreItemRef {
  itemId: string;
  name: string;
  path: string;
}

export async function queryItemByPath(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: string,
): Promise<SitecoreItemRef | null> {
  const data = await runAuthoring<{ item?: SitecoreItemRef | null }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: {
          database: "${MASTER_DATABASE}"
          path: "${escapeGraphQL(path)}"
          language: "${escapeGraphQL(language)}"
        }) {
          itemId
          name
          path
        }
      }
    `,
  );
  return data.item ?? null;
}

/** One field's raw value off an item, or null when the item doesn't exist. */
export async function getItemFieldValue(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  fieldName: string,
  language: string,
): Promise<string | null> {
  const data = await runAuthoring<{
    item?: { field?: { value?: string | null } | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: {
          database: "${MASTER_DATABASE}"
          path: "${escapeGraphQL(path)}"
          language: "${escapeGraphQL(language)}"
        }) {
          field(name: "${escapeGraphQL(fieldName)}") { value }
        }
      }
    `,
  );
  return data.item?.field?.value ?? null;
}

export async function createItem(
  client: ClientSDK,
  sitecoreContextId: string,
  parentId: string,
  templateId: string,
  itemName: string,
  language: string,
): Promise<SitecoreItemRef | null> {
  const data = await runAuthoring<{
    createItem?: { item?: SitecoreItemRef | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        createItem(input: {
          database: "${MASTER_DATABASE}"
          name: "${escapeGraphQL(itemName)}"
          parent: "${escapeGraphQL(parentId)}"
          templateId: "${escapeGraphQL(templateId)}"
          language: "${escapeGraphQL(language)}"
        }) {
          item { itemId name path }
        }
      }
    `,
  );
  return data.createItem?.item ?? null;
}

export async function updateItemField(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  itemPath: string,
  fieldName: string,
  fieldValue: string,
  language: string,
): Promise<void> {
  await runAuthoring<{ updateItem?: unknown }>(
    client,
    sitecoreContextId,
    `
      mutation {
        updateItem(input: {
          fields: [
            {
              name: "${escapeGraphQL(fieldName)}",
              value: "${escapeGraphQL(fieldValue)}",
              reset: false
            }
          ]
          database: "${MASTER_DATABASE}"
          itemId: "${escapeGraphQL(itemId)}"
          language: "${escapeGraphQL(language)}"
          path: "${escapeGraphQL(itemPath)}"
          version: 1
        }) {
          item { itemId }
        }
      }
    `,
  );
}

/* ---------------------------------------------------------------- workflows */

interface WorkflowNode {
  workflowId?: string;
  displayName?: string;
  states?: { edges?: Array<{ node?: Partial<WorkflowState> }> };
}

/**
 * Workflow definitions are the children of `/sitecore/system/Workflows`; the
 * `workflow` root query then supplies each one's states.
 */
export async function listWorkflows(
  client: ClientSDK,
  sitecoreContextId: string,
  language: string,
): Promise<WorkflowSummary[]> {
  const data = await runAuthoring<{
    item?: { children?: { nodes?: SitecoreItemRef[] } } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: {
          database: "${MASTER_DATABASE}"
          path: "${WORKFLOWS_ROOT}"
          language: "${escapeGraphQL(language)}"
        }) {
          children { nodes { itemId name path } }
        }
      }
    `,
  );

  const nodes = data.item?.children?.nodes ?? [];

  const summaries = await Promise.all(
    nodes.map(async (node) => {
      try {
        return await getWorkflow(
          client,
          sitecoreContextId,
          node.itemId,
          node.name,
        );
      } catch {
        // A child that isn't a real workflow definition (or one the user can't
        // read) shouldn't take down the whole list.
        return null;
      }
    }),
  );

  return summaries.filter((w): w is WorkflowSummary => w !== null);
}

export async function getWorkflow(
  client: ClientSDK,
  sitecoreContextId: string,
  workflowId: string,
  fallbackName: string,
): Promise<WorkflowSummary | null> {
  const data = await runAuthoring<{ workflow?: WorkflowNode | null }>(
    client,
    sitecoreContextId,
    `
      query {
        workflow(where: { workflowId: "${escapeGraphQL(workflowId)}" }) {
          workflowId
          displayName
          states(first: 100) {
            edges { node { stateId displayName final } }
          }
        }
      }
    `,
  );

  const workflow = data.workflow;
  if (!workflow) return null;

  const states = (workflow.states?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is WorkflowState => Boolean(node?.stateId))
    .map((node) => ({
      stateId: node.stateId,
      displayName: node.displayName || node.stateId,
      final: Boolean(node.final),
    }));

  return {
    workflowId: workflow.workflowId ?? workflowId,
    displayName: workflow.displayName || fallbackName,
    states,
  };
}

/** Commands available from one state — cached per (workflow, state) by the page. */
export async function getStateCommands(
  client: ClientSDK,
  sitecoreContextId: string,
  workflowId: string,
  stateId: string,
): Promise<WorkflowCommand[]> {
  const data = await runAuthoring<{
    workflow?: {
      commands?: { edges?: Array<{ node?: Partial<WorkflowCommand> }> };
    } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        workflow(where: { workflowId: "${escapeGraphQL(workflowId)}" }) {
          commands(query: { stateId: "${escapeGraphQL(stateId)}" }, first: 100) {
            edges { node { commandId displayName } }
          }
        }
      }
    `,
  );

  const commands = (data.workflow?.commands?.edges ?? [])
    .map((edge) => edge.node)
    .filter(
      (node): node is { commandId: string; displayName?: string } =>
        Boolean(node?.commandId),
    )
    .map((node) => ({
      commandId: node.commandId,
      displayName: node.displayName || node.commandId,
    }));

  if (commands.length === 0) return [];

  // The commands query doesn't expose item fields, so the "Suppress Comment"
  // flag comes from one aliased lookup of every command item. Best-effort: if
  // this fails, no command asks for a comment.
  let suppressByIndex: boolean[] = commands.map(() => false);
  try {
    const fieldQueries = commands
      .map(
        (command, index) => `
          c${index}: item(where: {
            database: "${MASTER_DATABASE}"
            itemId: "${escapeGraphQL(command.commandId)}"
            language: "${DEFAULT_LANGUAGE}"
          }) {
            field(name: "Suppress Comment") { value }
          }
        `,
      )
      .join("\n");

    const fields = await runAuthoringPartial<
      Record<string, { field?: { value?: string | null } | null } | null>
    >(client, sitecoreContextId, `query { ${fieldQueries} }`);

    suppressByIndex = commands.map(
      (_, index) => fields[`c${index}`]?.field?.value === "1",
    );
  } catch {
    // Field lookup failed — fall back to running every command without asking.
  }

  return commands.map((command, index) => ({
    ...command,
    suppressComment: suppressByIndex[index],
  }));
}

/* --------------------------------------------------------------- scan pages */

interface SearchInnerItem {
  itemId?: string;
  name?: string;
  displayName?: string;
  path?: string;
  version?: number;
  language?: { name?: string };
  template?: { name?: string };
  updated?: { value?: string } | null;
  updatedBy?: { value?: string } | null;
  renderings?: { value?: string } | null;
  finalRenderings?: { value?: string } | null;
  workflow?: {
    workflow?: { workflowId?: string; displayName?: string };
    workflowState?: { stateId?: string; displayName?: string; final?: boolean };
  } | null;
}

export interface ScanPage {
  totalCount: number;
  items: WorkboxItem[];
  /** Raw result count, so the caller knows whether the API ran out of pages. */
  rawCount: number;
}

/**
 * One page of the scan.
 *
 * The workflow state is read off `innerItem` (i.e. resolved live from the
 * database) rather than filtered in the index, because the index field name for
 * `__Workflow state` cannot be relied on across environments. The index is used
 * only to enumerate the items under the scope.
 *
 * Row data (name, template, audit fields) comes back with the same request: the
 * "Only my items" and text filters have to apply to the whole result set, not
 * just the visible page, so there is nothing to gain by deferring it.
 */
export async function scanWorkflowItems(
  client: ClientSDK,
  sitecoreContextId: string,
  options: {
    scopeItemId: string;
    language: string;
    pageIndex: number;
    pageSize?: number;
  },
): Promise<ScanPage> {
  const { scopeItemId, language, pageIndex, pageSize = SCAN_PAGE_SIZE } = options;

  const criteria = [
    `{ operator: MUST, field: "_path", value: "${stripBraces(scopeItemId)}" }`,
  ];
  if (language !== ALL_LANGUAGES) {
    criteria.push(
      `{ operator: MUST, field: "_language", value: "${escapeGraphQL(language)}" }`,
    );
  }

  const data = await runAuthoringPartial<{
    search?: {
      totalCount?: number;
      results?: Array<{ innerItem?: SearchInnerItem | null }>;
    } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        search(query: {
          index: "sitecore_master_index"
          searchStatement: { criteria: [${criteria.join("\n")}] }
          paging: { pageSize: ${pageSize}, pageIndex: ${pageIndex} }
        }) {
          totalCount
          results {
            innerItem {
              itemId
              name
              displayName
              path
              version
              language { name }
              template { name }
              updated: field(name: "__Updated") { value }
              updatedBy: field(name: "__Updated by") { value }
              renderings: field(name: "__Renderings") { value }
              finalRenderings: field(name: "__Final Renderings") { value }
              workflow {
                workflow { workflowId displayName }
                workflowState { stateId displayName final }
              }
            }
          }
        }
      }
    `,
  );

  // Partial errors are fine (broken results come back as null rows), but a
  // missing search root means the query itself failed and must surface.
  if (!data.search) {
    throw new Error("The search query returned no result set");
  }

  const results = data.search.results ?? [];
  const items: WorkboxItem[] = [];

  for (const result of results) {
    const inner = result.innerItem;
    const state = inner?.workflow?.workflowState;
    if (!inner?.itemId || !state?.stateId) continue;

    const itemLanguage = inner.language?.name || language;
    const version = inner.version ?? 1;

    // Datasource references off the layout XML (`ds="..."`, including the
    // `s:ds` form in Final Renderings deltas): GUIDs, paths or `local:/...`.
    const layoutXml = `${inner.renderings?.value ?? ""}\n${inner.finalRenderings?.value ?? ""}`;
    const datasourceRefs = [
      ...new Set(
        Array.from(layoutXml.matchAll(/\bds="([^"]+)"/g), (m) => m[1]),
      ),
    ];

    items.push({
      key: `${inner.itemId}|${itemLanguage}|${version}`,
      itemId: inner.itemId,
      path: inner.path ?? "",
      language: itemLanguage,
      version,
      workflowId: inner.workflow?.workflow?.workflowId ?? "",
      workflowName: inner.workflow?.workflow?.displayName ?? "Workflow",
      stateId: state.stateId,
      stateName: state.displayName || state.stateId,
      final: Boolean(state.final),
      name: inner.name ?? "",
      displayName: inner.displayName || inner.name || "",
      templateName: inner.template?.name ?? "",
      // A page is an item with layout details; either field counts, and the
      // value may be inherited from the template's standard values.
      hasLayout: Boolean(
        inner.renderings?.value?.trim() || inner.finalRenderings?.value?.trim(),
      ),
      datasourceRefs,
      updated: inner.updated?.value ?? "",
      updatedBy: inner.updatedBy?.value ?? "",
    });
  }

  return {
    totalCount: data.search?.totalCount ?? 0,
    items,
    rawCount: results.length,
  };
}

/* ------------------------------------------------------------------ details */

/** Everything the details drawer shows for one item version. */
export async function getItemFull(
  client: ClientSDK,
  sitecoreContextId: string,
  item: WorkboxItem,
): Promise<WorkboxItemFull | null> {
  const data = await runAuthoring<{
    item?: {
      itemId?: string;
      name?: string;
      displayName?: string;
      path?: string;
      template?: { name?: string };
      updated?: { value?: string } | null;
      updatedBy?: { value?: string } | null;
      fields?: { nodes?: ItemFieldValue[] };
    } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: {
          database: "${MASTER_DATABASE}"
          itemId: "${escapeGraphQL(item.itemId)}"
          language: "${escapeGraphQL(item.language)}"
          version: ${item.version}
        }) {
          itemId
          name
          displayName
          path
          template { name }
          updated: field(name: "__Updated") { value }
          updatedBy: field(name: "__Updated by") { value }
          fields(ownFields: true, excludeStandardFields: true) {
            nodes { name value }
          }
        }
      }
    `,
  );

  const node = data.item;
  if (!node) return null;

  return {
    itemId: node.itemId ?? item.itemId,
    path: node.path ?? item.path,
    language: item.language,
    version: item.version,
    name: node.name ?? "",
    displayName: node.displayName || node.name || "",
    templateName: node.template?.name ?? "",
    updated: node.updated?.value ?? "",
    updatedBy: node.updatedBy?.value ?? "",
    fields: node.fields?.nodes ?? [],
  };
}

/* ----------------------------------------------------------------- commands */

/**
 * Runs one workflow command against one item version.
 *
 * Resolves rather than throws on a refused command: a bulk run reports every
 * item's outcome and must not abort on the first failure. Transport-level
 * failures (`runAuthoring` throwing) are mapped to the same shape.
 */
export async function executeWorkflowCommand(
  client: ClientSDK,
  sitecoreContextId: string,
  item: WorkboxItem,
  commandId: string,
  comments: string,
): Promise<CommandRunResult> {
  const base = {
    key: item.key,
    path: item.path,
    language: item.language,
    version: item.version,
  };

  try {
    const data = await runAuthoring<{
      executeWorkflowCommand?: {
        successful?: boolean;
        completed?: boolean;
        message?: string | null;
        error?: string | null;
        nextStateId?: string | null;
      } | null;
    }>(
      client,
      sitecoreContextId,
      `
        mutation {
          executeWorkflowCommand(input: {
            item: {
              database: "${MASTER_DATABASE}"
              itemId: "${escapeGraphQL(item.itemId)}"
              language: "${escapeGraphQL(item.language)}"
              version: ${item.version}
            }
            commandId: "${escapeGraphQL(commandId)}"
            comments: "${escapeGraphQL(comments)}"
          }) {
            successful
            completed
            message
            error
            nextStateId
          }
        }
      `,
    );

    const result = data.executeWorkflowCommand;
    const ok = Boolean(result?.successful);
    return {
      ...base,
      ok,
      message:
        result?.error ||
        result?.message ||
        (ok ? "Command executed" : "Command was refused"),
      nextStateId: result?.nextStateId ?? null,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      nextStateId: null,
    };
  }
}

/* ---------------------------------------------------------------- publishing */

/**
 * Smart-publishes a single item to Experience Edge. Mirrors the publish call in
 * the dictionary app: sub-items on, related items off.
 */
export async function publishItem(
  client: ClientSDK,
  sitecoreContextId: string,
  itemPath: string,
  languages: string[],
): Promise<string> {
  const langList = languages.map((l) => `"${escapeGraphQL(l)}"`).join(", ");

  const data = await runAuthoring<{
    publishItem?: { operationId?: string } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        publishItem(input: {
          rootItemPath: "${escapeGraphQL(itemPath)}"
          languages: [${langList}]
          targetDatabases: "experienceedge"
          publishItemMode: SMART
          publishRelatedItems: false
          publishSubItems: false
        }) {
          operationId
        }
      }
    `,
  );

  const operationId = data.publishItem?.operationId;
  if (!operationId) throw new Error("No publish operation id returned");
  return operationId;
}
