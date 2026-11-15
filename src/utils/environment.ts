/*
 * Shared between Workbox and Dictionary: keep the copies identical.
 *
 * Opened as Full Screen inside an environment the host reports that one
 * environment and there is nothing to choose. Opened from the Standalone
 * extension point it reports every environment the app is installed on, and
 * the user picks one; the pick is remembered per user in localStorage.
 */

export interface EnvironmentOption {
  /** Stable identifier of the environment (tenant id). */
  id: string;
  /** Context id for the authoring GraphQL API (`context.preview`). */
  contextId: string;
  /** Context id the sites API wants (`context.live`). */
  liveContextId: string;
  label: string;
}

/** The environments in `application.context` this app can work on. */
export function readEnvironments(appContext: unknown): EnvironmentOption[] {
  const resourceAccess = (appContext as Record<string, unknown> | undefined)
    ?.resourceAccess as
    | Array<{
        tenantId?: string | null;
        tenantName?: string | null;
        tenantDisplayName?: string | null;
        context?: { preview?: string; live?: string };
      }>
    | undefined;

  const seen = new Set<string>();
  const environments: EnvironmentOption[] = [];
  for (const resource of resourceAccess ?? []) {
    const preview = resource?.context?.preview;
    if (!preview) continue;
    const id = resource.tenantId || preview;
    if (seen.has(id)) continue;
    seen.add(id);
    environments.push({
      id,
      contextId: preview,
      liveContextId: resource.context?.live ?? "",
      label:
        resource.tenantDisplayName || resource.tenantName || "this environment",
    });
  }
  return environments;
}

/**
 * One environment: that one. Several: the one remembered under `storageKey`,
 * or null — the user has to be asked.
 */
export function pickEnvironment(
  environments: EnvironmentOption[],
  storageKey: string,
): EnvironmentOption | null {
  if (environments.length <= 1) return environments[0] ?? null;
  let remembered = "";
  try {
    remembered = window.localStorage.getItem(storageKey) ?? "";
  } catch {
    // Storage unavailable — ask every time.
  }
  return environments.find((item) => item.id === remembered) ?? null;
}

/**
 * Remembers the choice and reloads the app, so nothing loaded from the
 * previous environment can stay on screen.
 */
export function switchEnvironment(
  environment: EnvironmentOption,
  storageKey: string,
): void {
  try {
    window.localStorage.setItem(storageKey, environment.id);
  } catch {
    // Not remembered; the reload below would ask again.
  }
  window.location.reload();
}
