"use client";

import { mdiCheckCircleOutline, mdiInboxOutline, mdiLoading } from "@mdi/js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { BulkActionBar } from "@/components/workbox/bulk-action-bar";
import { CommandDialog } from "@/components/workbox/command-dialog";
import { EmptyState } from "@/components/workbox/empty-state";
import { ItemDetailsDrawer } from "@/components/workbox/item-details-drawer";
import { ItemTable } from "@/components/workbox/item-table";
import { ScanProgress } from "@/components/workbox/scan-progress";
import { ScopeToolbar } from "@/components/workbox/scope-toolbar";
import { SettingsPage } from "@/components/workbox/settings-page";
import { WorkflowBar } from "@/components/workbox/workflow-bar";
import {
  ALL_LANGUAGES,
  CONTENT_ROOT,
  DEFAULT_LANGUAGE,
  DEFAULT_ROW_PAGE_SIZE,
} from "@/src/constants";
import type {
  CommandRunResult,
  ScanScope,
  WorkboxItem,
  WorkboxSettings,
  WorkflowCommand,
  WorkflowSummary,
} from "@/src/types/workbox";
import { idKey } from "@/src/utils/format";
import { expandWithDatasources } from "@/src/utils/grouping";
import { loadPrefs, savePrefs } from "@/src/utils/prefs";
import {
  DEFAULT_WORKBOX_SETTINGS,
  loadWorkboxSettings,
  saveWorkboxSettings,
} from "@/src/utils/settings";
import {
  executeWorkflowCommand,
  getEnvironmentContext,
  getHostUserEmail,
  getStateCommands,
  listLanguages,
  listSites,
  listWorkflows,
  publishItem,
  type EnvironmentContext,
  type SiteInfo,
} from "@/src/utils/sitecore-graphql";
import { buildItemLinks } from "@/src/utils/site-links";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import { useWorkboxScan } from "@/src/utils/hooks/useWorkboxScan";

const ALL_CONTENT_SCOPE: ScanScope = {
  id: "__all-content",
  label: "All content",
  path: CONTENT_ROOT,
};

interface ToastState {
  title: string;
  description: string;
  variant: "success" | "error" | "warning";
}

export default function FullScreenExtension() {
  const { client, error: sdkError, isInitialized } = useMarketplaceClient();

  const [env, setEnv] = useState<EnvironmentContext | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [scopes, setScopes] = useState<ScanScope[]>([ALL_CONTENT_SCOPE]);
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [languages, setLanguages] = useState<string[]>([DEFAULT_LANGUAGE]);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [userEmail, setUserEmail] = useState("");

  // Admin settings (content tree, shared across users of this environment).
  const [settings, setSettings] = useState<WorkboxSettings>(
    DEFAULT_WORKBOX_SETTINGS,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // View state (persisted to localStorage).
  const [scopeId, setScopeId] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [rowPageSize, setRowPageSize] = useState<number>(DEFAULT_ROW_PAGE_SIZE);
  const [includeFinal, setIncludeFinal] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyPages, setOnlyPages] = useState(false);
  const [filterText, setFilterText] = useState("");

  const [workflowId, setWorkflowId] = useState("");
  const [stateId, setStateId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [commandsCache, setCommandsCache] = useState<
    Record<string, WorkflowCommand[]>
  >({});
  const [commandsLoading, setCommandsLoading] = useState(false);

  const [pendingRun, setPendingRun] = useState<{
    command: WorkflowCommand;
    items: WorkboxItem[];
  } | null>(null);
  const [comment, setComment] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CommandRunResult[]>([]);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  // Rows whose command succeeded: they stay on screen, grayed out, until the
  // next scan replaces the result — no auto-refresh after a run.
  const [invalidatedKeys, setInvalidatedKeys] = useState<Set<string>>(
    new Set(),
  );

  const [detailsItem, setDetailsItem] = useState<WorkboxItem | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const scan = useWorkboxScan(client, env?.contextId ?? "");
  const { start: startScan, cancel: cancelScan } = scan;

  const showToast = useCallback(
    (title: string, description: string, variant: ToastState["variant"]) => {
      setToast({ title, description, variant });
    },
    [],
  );

  /* ------------------------------------------------------------- bootstrap */

  const bootedRef = useRef(false);

  useEffect(() => {
    if (!isInitialized || !client || bootedRef.current) return;
    bootedRef.current = true;

    let active = true;

    (async () => {
      try {
        const context = await getEnvironmentContext(client);
        if (!active) return;

        if (!context) {
          setBootError(
            "This app could not read an environment from the Marketplace host.",
          );
          setBooting(false);
          return;
        }
        setEnv(context);

        const [
          sitesResult,
          languagesResult,
          workflowsResult,
          emailResult,
          settingsResult,
        ] = await Promise.allSettled([
          listSites(client, context.liveContextId),
          listLanguages(client, context.contextId),
          listWorkflows(client, context.contextId, DEFAULT_LANGUAGE),
          getHostUserEmail(client),
          loadWorkboxSettings(client, context.contextId),
        ]);

        if (!active) return;

        const nextSites =
          sitesResult.status === "fulfilled" ? sitesResult.value : [];
        setSites(nextSites);
        const siteScopes: ScanScope[] = nextSites.map((site) => ({
          id: site.rootPath,
          label: site.name,
          path: site.rootPath,
        }));
        const nextScopes = [...siteScopes, ALL_CONTENT_SCOPE];
        setScopes(nextScopes);

        const nextLanguages =
          languagesResult.status === "fulfilled"
            ? languagesResult.value
            : [DEFAULT_LANGUAGE];
        setLanguages(nextLanguages);

        if (workflowsResult.status === "fulfilled") {
          setWorkflows(workflowsResult.value);
        } else {
          // Not fatal: the scan still reports the workflow and state each item
          // is in, so the UI falls back to what it observes.
          setWorkflows([]);
        }

        if (emailResult.status === "fulfilled") setUserEmail(emailResult.value);
        if (settingsResult.status === "fulfilled") {
          setSettings(settingsResult.value);
        }

        const prefs = loadPrefs();
        setScopeId(
          prefs.scopeId && nextScopes.some((s) => s.id === prefs.scopeId)
            ? prefs.scopeId
            : nextScopes[0].id,
        );
        setLanguage(
          prefs.language &&
            (prefs.language === ALL_LANGUAGES ||
              nextLanguages.includes(prefs.language))
            ? prefs.language
            : nextLanguages.includes(DEFAULT_LANGUAGE)
              ? DEFAULT_LANGUAGE
              : nextLanguages[0],
        );
        if (prefs.rowPageSize) setRowPageSize(prefs.rowPageSize);
        if (prefs.includeFinal !== undefined) setIncludeFinal(prefs.includeFinal);
        if (prefs.onlyMine !== undefined) setOnlyMine(prefs.onlyMine);
        if (prefs.onlyPages !== undefined) setOnlyPages(prefs.onlyPages);

        setBooting(false);
      } catch (error) {
        if (!active) return;
        setBootError(error instanceof Error ? error.message : String(error));
        setBooting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [client, isInitialized]);

  /* ---------------------------------------------------- admin settings gates */

  // Empty selection = everything; a selection that no longer matches anything
  // (site removed, language deleted) also falls back to everything rather than
  // bricking the app.
  const allowedScopes = useMemo(() => {
    if (settings.scopeIds.length === 0) return scopes;
    const filtered = scopes.filter((scope) =>
      settings.scopeIds.includes(scope.id),
    );
    return filtered.length > 0 ? filtered : scopes;
  }, [scopes, settings.scopeIds]);

  const allowedLanguages = useMemo(() => {
    if (settings.languages.length === 0) return languages;
    const filtered = languages.filter((code) =>
      settings.languages.includes(code),
    );
    return filtered.length > 0 ? filtered : languages;
  }, [languages, settings.languages]);

  const languagesRestricted =
    settings.languages.length > 0 && allowedLanguages !== languages;

  // Keep the current selections inside the allowed lists (settings load after
  // the prefs, and can change on save).
  useEffect(() => {
    if (booting || allowedScopes.length === 0) return;
    if (!allowedScopes.some((scope) => scope.id === scopeId)) {
      setScopeId(allowedScopes[0].id);
    }
  }, [booting, allowedScopes, scopeId]);

  useEffect(() => {
    if (booting || allowedLanguages.length === 0) return;
    if (language === ALL_LANGUAGES && !languagesRestricted) return;
    if (!allowedLanguages.includes(language)) {
      setLanguage(
        allowedLanguages.includes(DEFAULT_LANGUAGE)
          ? DEFAULT_LANGUAGE
          : allowedLanguages[0],
      );
    }
  }, [booting, allowedLanguages, languagesRestricted, language]);

  // Hidden controls fall back to their defaults instead of a value the user
  // can no longer see or change; forced filters override the user's toggle.
  const effectiveIncludeFinal = settings.showFinalStates ? includeFinal : false;
  const effectiveOnlyMine = settings.forceOnlyMine
    ? true
    : settings.showOnlyMine
      ? onlyMine
      : false;
  // Pages-only filters everything; grouped shows everything (the table nests
  // the data sources); flat leaves it to the user's toolbar switch.
  const effectiveOnlyPages =
    settings.pageDisplay === "pagesOnly"
      ? true
      : settings.pageDisplay === "flat"
        ? onlyPages
        : false;
  const effectiveRowPageSize = settings.showRows
    ? rowPageSize
    : DEFAULT_ROW_PAGE_SIZE;

  /* ------------------------------------------------------------------ scan */

  const currentScope = useMemo(
    () => allowedScopes.find((scope) => scope.id === scopeId) ?? null,
    [allowedScopes, scopeId],
  );

  useEffect(() => {
    if (booting || !env || !currentScope) return;
    void startScan({ scopePath: currentScope.path, language });
  }, [booting, env, currentScope, language, startScan]);

  // A fresh scan result supersedes the grayed-out "moved" rows.
  useEffect(() => {
    setInvalidatedKeys(new Set());
  }, [scan.result]);

  const refresh = useCallback(() => {
    if (!currentScope) return;
    void startScan({ scopePath: currentScope.path, language });
  }, [currentScope, language, startScan]);

  useEffect(() => {
    if (booting) return;
    savePrefs({
      scopeId,
      language,
      rowPageSize,
      includeFinal,
      onlyMine,
      onlyPages,
    });
  }, [booting, scopeId, language, rowPageSize, includeFinal, onlyMine, onlyPages]);

  /* ------------------------------------------------- workflows and states */

  /**
   * The workflow definitions, widened with anything the scan observed. If the
   * `workflow` root query is unavailable the app still works off the workflow
   * and state each item reports.
   */
  const effectiveWorkflows = useMemo<WorkflowSummary[]>(() => {
    const byKey = new Map<string, WorkflowSummary>();
    for (const workflow of workflows) {
      byKey.set(idKey(workflow.workflowId), {
        ...workflow,
        states: [...workflow.states],
      });
    }

    for (const item of scan.result?.items ?? []) {
      if (!item.workflowId) continue;
      const key = idKey(item.workflowId);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          workflowId: item.workflowId,
          displayName: item.workflowName,
          states: [
            {
              stateId: item.stateId,
              displayName: item.stateName,
              final: item.final,
              observed: true,
            },
          ],
        });
        continue;
      }
      if (
        !existing.states.some((s) => idKey(s.stateId) === idKey(item.stateId))
      ) {
        existing.states.push({
          stateId: item.stateId,
          displayName: item.stateName,
          final: item.final,
          observed: true,
        });
      }
    }

    return [...byKey.values()];
  }, [workflows, scan.result]);

  // Settings can pin the workflows on offer; same fallback rule as the scopes.
  const allowedWorkflows = useMemo(() => {
    if (settings.workflowIds.length === 0) return effectiveWorkflows;
    const keys = new Set(settings.workflowIds.map(idKey));
    const filtered = effectiveWorkflows.filter((w) =>
      keys.has(idKey(w.workflowId)),
    );
    return filtered.length > 0 ? filtered : effectiveWorkflows;
  }, [effectiveWorkflows, settings.workflowIds]);

  const workflow = useMemo(
    () =>
      allowedWorkflows.find((w) => idKey(w.workflowId) === idKey(workflowId)) ??
      null,
    [allowedWorkflows, workflowId],
  );

  // Set once the user picks a workflow themselves, so the auto-pick below stops
  // dragging them off a workflow they deliberately opened.
  const workflowChosenRef = useRef(false);
  const chooseWorkflow = useCallback((id: string) => {
    workflowChosenRef.current = true;
    setWorkflowId(id);
  }, []);

  // Keep the selected workflow valid, defaulting to one that actually has items.
  useEffect(() => {
    if (allowedWorkflows.length === 0) return;
    const buckets = scan.result?.byWorkflow ?? {};
    const countFor = (id: string) =>
      Object.values(buckets[idKey(id)] ?? {}).reduce(
        (sum, items) => sum + items.length,
        0,
      );

    const stillValid = allowedWorkflows.some(
      (w) => idKey(w.workflowId) === idKey(workflowId),
    );
    if (stillValid && (workflowChosenRef.current || countFor(workflowId) > 0)) {
      return;
    }

    const withItems = allowedWorkflows.find((w) => countFor(w.workflowId) > 0);
    const next = withItems ?? allowedWorkflows[0];
    if (idKey(next.workflowId) !== idKey(workflowId)) {
      setWorkflowId(next.workflowId);
    }
  }, [allowedWorkflows, scan.result, workflowId]);

  /* --------------------------------------------------------------- filters */

  const matchesFilters = useCallback(
    (item: WorkboxItem) => {
      if (effectiveOnlyPages && !item.hasLayout) return false;
      if (effectiveOnlyMine && userEmail) {
        if (!item.updatedBy.toLowerCase().includes(userEmail.toLowerCase())) {
          return false;
        }
      }
      const needle = filterText.trim().toLowerCase();
      if (!needle) return true;
      return (
        item.path.toLowerCase().includes(needle) ||
        item.displayName.toLowerCase().includes(needle) ||
        item.name.toLowerCase().includes(needle)
      );
    },
    [effectiveOnlyPages, effectiveOnlyMine, userEmail, filterText],
  );

  const stateBuckets = useMemo(
    () => scan.result?.byWorkflow[idKey(workflowId)] ?? {},
    [scan.result, workflowId],
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [key, items] of Object.entries(stateBuckets)) {
      const filtered = items.filter(matchesFilters);
      // Grouped mode lists pages as the rows, so the tab counts pages too.
      result[key] =
        settings.pageDisplay === "grouped"
          ? filtered.filter((item) => item.hasLayout).length
          : filtered.length;
    }
    return result;
  }, [stateBuckets, matchesFilters, settings.pageDisplay]);

  const visibleStates = useMemo(() => {
    if (!workflow) return [];
    // Observed-only states (reported by items, absent from the definition —
    // e.g. a state id belonging to another workflow) only earn a tab while
    // they hold visible items; definition states always show, even at 0.
    const states = workflow.states.filter(
      (state) => !state.observed || (counts[idKey(state.stateId)] ?? 0) > 0,
    );
    const nonFinal = states.filter((state) => !state.final);
    const final = states.filter((state) => state.final);
    return effectiveIncludeFinal ? [...nonFinal, ...final] : nonFinal;
  }, [workflow, effectiveIncludeFinal, counts]);

  // Keep the selected state valid, preferring the first one that has items.
  useEffect(() => {
    if (visibleStates.length === 0) {
      if (stateId) setStateId("");
      return;
    }
    const stillValid = visibleStates.some(
      (state) => idKey(state.stateId) === idKey(stateId),
    );
    if (stillValid) return;

    const withItems = visibleStates.find(
      (state) => (counts[idKey(state.stateId)] ?? 0) > 0,
    );
    setStateId((withItems ?? visibleStates[0]).stateId);
  }, [visibleStates, stateId, counts]);

  const stateItems = useMemo(() => {
    const bucket = stateBuckets[idKey(stateId)] ?? [];
    return bucket.filter(matchesFilters);
  }, [stateBuckets, stateId, matchesFilters]);

  // Any change to what is listed resets paging and selection.
  useEffect(() => {
    setPage(1);
    setSelectedKeys(new Set());
  }, [workflowId, stateId, filterText, onlyMine, onlyPages, language, scopeId]);

  /* -------------------------------------------------------------- commands */

  const commandsKey = workflowId && stateId ? `${workflowId}|${stateId}` : "";
  const commands = commandsKey ? (commandsCache[commandsKey] ?? []) : [];

  useEffect(() => {
    if (!client || !env || !commandsKey) return;
    if (commandsCache[commandsKey]) return;

    let active = true;
    setCommandsLoading(true);

    getStateCommands(client, env.contextId, workflowId, stateId)
      .then((next) => {
        if (active) {
          setCommandsCache((prev) => ({ ...prev, [commandsKey]: next }));
        }
      })
      .catch(() => {
        if (active) {
          setCommandsCache((prev) => ({ ...prev, [commandsKey]: [] }));
        }
      })
      .finally(() => {
        if (active) setCommandsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [client, env, commandsKey, commandsCache, workflowId, stateId]);

  const selectedItems = useMemo(
    () => stateItems.filter((item) => selectedKeys.has(item.key)),
    [stateItems, selectedKeys],
  );

  /* ------------------------------------------------------------- publishing */

  const publishItems = useCallback(
    async (candidates: WorkboxItem[]) => {
      if (!client || !env || candidates.length === 0) return;

      // One publish per (path, language) pair — several versions of the same
      // item resolve to the same publish.
      const seen = new Set<string>();
      const targets = candidates.filter((item) => {
        const key = `${item.path}|${item.language}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let published = 0;
      const failures: string[] = [];

      for (const item of targets) {
        try {
          await publishItem(client, env.contextId, item.path, [item.language]);
          published += 1;
        } catch (error) {
          failures.push(
            `${item.path}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (failures.length === 0) {
        showToast(
          "Publish queued",
          `${published} item${published === 1 ? "" : "s"} queued for publishing to Experience Edge.`,
          "success",
        );
      } else {
        showToast(
          "Publish partly failed",
          `${published} queued, ${failures.length} failed. ${failures[0]}`,
          "warning",
        );
      }
    },
    [client, env, showToast],
  );

  /* --------------------------------------------------------------- commands */

  const executeRun = useCallback(
    async (items: WorkboxItem[], command: WorkflowCommand, commentText: string) => {
      if (!client || !env || items.length === 0) return;

      setIsRunning(true);
      const collected: CommandRunResult[] = [];

      for (const item of items) {
        setBusyKeys((prev) => new Set(prev).add(item.key));
        // Sequential on purpose: workflow commands run actions that can cascade,
        // and a refused command must not abort the rest of the batch.
        const result = await executeWorkflowCommand(
          client,
          env.contextId,
          item,
          command.commandId,
          commentText,
        );
        collected.push(result);
        setResults([...collected]);
        setBusyKeys((prev) => {
          const next = new Set(prev);
          next.delete(item.key);
          return next;
        });
      }

      setIsRunning(false);
      setSelectedKeys(new Set());

      const succeeded = collected.filter((result) => result.ok).length;
      const failed = collected.length - succeeded;
      showToast(
        `${command.displayName} finished`,
        `${succeeded} succeeded${failed > 0 ? `, ${failed} failed` : ""}.`,
        failed > 0 ? "warning" : "success",
      );

      // Items that landed in a final state are published right away when the
      // auto-publish setting is on — there is no prompt either way.
      if (settings.autoPublish) {
        const finalStateKeys = new Set(
          (workflow?.states ?? [])
            .filter((state) => state.final)
            .map((state) => idKey(state.stateId)),
        );
        const byKey = new Map(items.map((item) => [item.key, item]));
        const candidates = collected
          .filter(
            (result) =>
              result.ok &&
              result.nextStateId &&
              finalStateKeys.has(idKey(result.nextStateId)),
          )
          .map((result) => byKey.get(result.key))
          .filter((item): item is WorkboxItem => Boolean(item));
        await publishItems(candidates);
      }

      // No grid refresh: the moved rows are grayed out in place instead, so
      // the user sees what happened without the list jumping around.
      setInvalidatedKeys((prev) => {
        const next = new Set(prev);
        for (const result of collected) {
          if (result.ok) next.add(result.key);
        }
        return next;
      });
    },
    [client, env, workflow, settings.autoPublish, publishItems, showToast],
  );

  /**
   * Entry point for every command click. When the cascade setting is on, each
   * targeted page is expanded to its data sources first, page last, so the
   * dialog lists — and the run covers — everything that will move. Whether the
   * comment dialog appears is driven by the command item's "Suppress Comment"
   * field (the requested mapping: dialog only when the field is "1");
   * otherwise the command runs immediately with an empty comment.
   */
  const openRun = useCallback(
    (items: WorkboxItem[], command: WorkflowCommand) => {
      if (items.length === 0 || isRunning) return;

      const pool = (stateBuckets[idKey(stateId)] ?? []).filter(
        (item) => !invalidatedKeys.has(item.key),
      );
      // The cascade applies in the grouped and pages-only modes — matching the
      // settings UI, where the switch is hidden in flat mode. It only ever
      // pulls in the page's OWN data sources (under <page path>/data/).
      const runItems = expandWithDatasources(
        items,
        pool,
        settings.pageDisplay !== "flat" &&
          settings.commandsIncludeDatasources,
      );

      if (command.suppressComment) {
        setResults([]);
        setComment("");
        setPendingRun({ command, items: runItems });
      } else {
        setResults([]);
        void executeRun(runItems, command, "");
      }
    },
    [
      isRunning,
      stateBuckets,
      stateId,
      invalidatedKeys,
      settings.pageDisplay,
      settings.commandsIncludeDatasources,
      executeRun,
    ],
  );

  const confirmRun = useCallback(async () => {
    if (!pendingRun) return;
    const { items, command } = pendingRun;

    // A single item doesn't need the results view: the dialog closes right
    // away and the row animation + toast carry the feedback. Bulk runs keep
    // the dialog open to report every item's outcome.
    if (items.length === 1) {
      setPendingRun(null);
      setResults([]);
      void executeRun(items, command, comment);
      return;
    }

    await executeRun(items, command, comment);
  }, [pendingRun, comment, executeRun]);

  const closeRun = useCallback(() => {
    setPendingRun(null);
    setResults([]);
  }, []);

  /* ------------------------------------------------------------- clipboard */

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied", `${label} copied to the clipboard.`, "success");
      } catch {
        showToast(
          "Copy failed",
          "The host blocked clipboard access for this app.",
          "error",
        );
      }
    },
    [showToast],
  );

  /* --------------------------------------------------------------- settings */

  const saveSettings = useCallback(
    async (next: WorkboxSettings) => {
      if (!client || !env) return;
      setIsSavingSettings(true);
      try {
        const saved = await saveWorkboxSettings(client, env.contextId, next);
        setSettings(saved);
        setShowSettings(false);
        showToast(
          "Settings saved",
          "The Workbox settings were updated for this environment.",
          "success",
        );
      } catch (error) {
        showToast(
          "Could not save settings",
          error instanceof Error ? error.message : String(error),
          "error",
        );
      } finally {
        setIsSavingSettings(false);
      }
    },
    [client, env, showToast],
  );

  const getItemLinks = useCallback(
    (item: WorkboxItem) => buildItemLinks(item, sites, settings.previewDomain),
    [sites, settings.previewDomain],
  );

  /* -------------------------------------------------------------- selection */

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleVisible = useCallback((keys: string[], selectAll: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (selectAll) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  /* ----------------------------------------------------------------- render */

  if (sdkError) {
    return (
      <main className="min-h-screen bg-surface-bright p-(--spacing-margin-page)">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-xl border border-danger bg-danger-bg p-6 text-danger-fg">
            <h2 className="mb-1 font-bold">Could not connect to SitecoreAI</h2>
            <p className="text-sm">{sdkError.message}</p>
            <p className="mt-2 text-sm">
              This app only runs inside SitecoreAI — open it from the
              environment&apos;s app menu.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!isInitialized || booting) {
    return (
      <main className="min-h-screen bg-surface-bright p-(--spacing-margin-page)">
        <div className="mx-auto flex max-w-[1280px] items-center justify-center py-32">
          <div className="flex items-center gap-3 text-text-subtle">
            <Icon path={mdiLoading} size={1} className="animate-spin" />
            <span>Connecting to Sitecore&hellip;</span>
          </div>
        </div>
      </main>
    );
  }

  if (bootError || !env) {
    return (
      <main className="min-h-screen bg-surface-bright p-(--spacing-margin-page)">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-xl border border-danger bg-danger-bg p-6 text-danger-fg">
            <h2 className="mb-1 font-bold">No environment access</h2>
            <p className="text-sm">
              {bootError ??
                "The Marketplace host did not report an environment this app can read."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const hasResult = scan.result !== null;

  return (
    <ToastProvider swipeDirection="right">
      <main className="min-h-screen bg-surface-bright p-(--spacing-margin-page)">
        <div className="mx-auto max-w-[1280px] space-y-5">
          {showSettings ? (
            <SettingsPage
              scopes={scopes}
              languages={languages}
              workflows={effectiveWorkflows}
              settings={settings}
              isSaving={isSavingSettings}
              onSave={(next) => void saveSettings(next)}
              onBack={() => setShowSettings(false)}
            />
          ) : (
            <>
              <ScopeToolbar
                scopes={allowedScopes}
                scopeId={scopeId}
                onScopeChange={setScopeId}
                showScope={allowedScopes.length > 1}
                languages={allowedLanguages}
                language={language}
                onLanguageChange={setLanguage}
                showLanguage={
                  !(languagesRestricted && allowedLanguages.length === 1)
                }
                allowAllLanguages={settings.languages.length === 0}
                filterText={filterText}
                onFilterTextChange={setFilterText}
                onlyPages={onlyPages}
                onOnlyPagesChange={setOnlyPages}
                showOnlyPages={settings.pageDisplay === "flat"}
                onlyMine={onlyMine}
                onOnlyMineChange={setOnlyMine}
                showOnlyMine={settings.showOnlyMine && !settings.forceOnlyMine}
                includeFinal={includeFinal}
                onIncludeFinalChange={setIncludeFinal}
                showIncludeFinal={settings.showFinalStates}
                rowPageSize={rowPageSize}
                onRowPageSizeChange={setRowPageSize}
                showRows={settings.showRows}
                workflows={allowedWorkflows}
                selectedWorkflowId={workflowId}
                onWorkflowChange={chooseWorkflow}
                onOpenSettings={() => setShowSettings(true)}
                onRefresh={refresh}
                isScanning={scan.isScanning}
                userEmail={userEmail}
              />

              <ScanProgress
                progress={scan.progress}
                isScanning={scan.isScanning}
                onCancel={cancelScan}
              />

              {scan.error && (
                <div className="rounded-xl border border-danger bg-danger-bg p-6 text-danger-fg">
                  <h2 className="mb-1 font-bold">Could not read this scope</h2>
                  <p className="text-sm">{scan.error}</p>
                </div>
              )}

              {!scan.error && hasResult && allowedWorkflows.length === 0 && (
                <EmptyState
                  icon={mdiCheckCircleOutline}
                  title="Nothing is in workflow"
                  description="No item under this scope is attached to a workflow. Pick a different scope, or bind a workflow to your templates first."
                />
              )}

              {!scan.error && hasResult && allowedWorkflows.length > 0 && (
                <>
                  <WorkflowBar
                    states={visibleStates}
                    counts={counts}
                    selectedStateId={stateId}
                    onStateChange={setStateId}
                  />

                  <BulkActionBar
                    selectedCount={selectedItems.length}
                    commands={commands}
                    onRunCommand={(command) => openRun(selectedItems, command)}
                    onClear={() => setSelectedKeys(new Set())}
                    disabled={isRunning}
                  />

                  {stateItems.length === 0 ? (
                    <EmptyState
                      icon={mdiInboxOutline}
                      title="Nothing is waiting here"
                      description="No item under this scope is in this state right now. Try another state, a wider scope, or clear the filters."
                    />
                  ) : (
                    <ItemTable
                      items={stateItems}
                      page={page}
                      pageSize={effectiveRowPageSize}
                      onPageChange={setPage}
                      groupDatasources={settings.pageDisplay === "grouped"}
                      getItemLinks={getItemLinks}
                      invalidatedKeys={invalidatedKeys}
                      selectedKeys={selectedKeys}
                      onToggleKey={toggleKey}
                      onToggleVisible={toggleVisible}
                      commands={commands}
                      commandsLoading={commandsLoading}
                      onRunCommand={openRun}
                      onOpenDetails={setDetailsItem}
                      busyKeys={busyKeys}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <CommandDialog
        open={pendingRun !== null}
        onOpenChange={(open) => {
          if (!open) closeRun();
        }}
        command={pendingRun?.command ?? null}
        items={pendingRun?.items ?? []}
        comment={comment}
        onCommentChange={setComment}
        isRunning={isRunning}
        results={results}
        onConfirm={() => void confirmRun()}
      />

      <ItemDetailsDrawer
        item={detailsItem}
        client={client}
        sitecoreContextId={env.contextId}
        onClose={() => setDetailsItem(null)}
        onCopy={(text, label) => void copyToClipboard(text, label)}
      />

      {toast && (
        <Toast
          open
          variant={toast.variant}
          duration={5000}
          onOpenChange={(open) => !open && setToast(null)}
        >
          <div className="min-w-0">
            <ToastTitle>{toast.title}</ToastTitle>
            <ToastDescription>{toast.description}</ToastDescription>
          </div>
        </Toast>
      )}
      <ToastViewport />
    </ToastProvider>
  );
}
