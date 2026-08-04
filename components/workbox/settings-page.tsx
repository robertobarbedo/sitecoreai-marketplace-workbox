"use client";

import { mdiArrowLeft, mdiInformationOutline, mdiLoading } from "@mdi/js";
import { useState } from "react";

import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  PageDisplayMode,
  ScanScope,
  WorkboxSettings,
  WorkflowSummary,
} from "@/src/types/workbox";
import { idKey } from "@/src/utils/format";

/**
 * The three option lists share one convention (documented next to
 * `WorkboxSettings`): none checked = everything is available; exactly one =
 * fixed, the input disappears from the Workbox UI; several = the input only
 * offers those.
 */
const LIST_HINT =
  "Turn nothing on to offer every option. Turn exactly one on to fix it and hide the input. Turn several on to limit the input to them.";

function SettingsSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-muted bg-white p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">
        {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-text-subtle">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CheckList({
  options,
  isChecked,
  onToggle,
}: {
  options: Array<{ value: string; label: string; detail?: string }>;
  isChecked: (value: string) => boolean;
  onToggle: (value: string, checked: boolean) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-sm text-text-subtle">
        Nothing to list — the environment reported no options.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-2 text-sm text-on-surface-variant"
        >
          <Switch
            checked={isChecked(option.value)}
            onChange={(event) => onToggle(option.value, event.target.checked)}
          />
          {option.label}
          {option.detail && (
            <span className="text-xs text-text-subtle">{option.detail}</span>
          )}
        </label>
      ))}
    </div>
  );
}

export interface SettingsPageProps {
  scopes: ScanScope[];
  languages: string[];
  workflows: WorkflowSummary[];
  settings: WorkboxSettings;
  isSaving: boolean;
  onSave: (next: WorkboxSettings) => void;
  onBack: () => void;
}

export function SettingsPage({
  scopes,
  languages,
  workflows,
  settings,
  isSaving,
  onSave,
  onBack,
}: SettingsPageProps) {
  const [draft, setDraft] = useState<WorkboxSettings>(settings);

  const toggleIn = (list: string[], value: string, checked: boolean) =>
    checked ? [...list, value] : list.filter((entry) => entry !== value);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={isSaving}
          aria-label="Back to Workbox"
        >
          <Icon path={mdiArrowLeft} size={1} />
        </Button>
        <h2 className="font-bold text-on-surface">Settings</h2>
        <Button
          className="ml-auto"
          onClick={() => onSave(draft)}
          disabled={isSaving}
        >
          {isSaving && (
            <Icon path={mdiLoading} size={0.9} className="animate-spin" />
          )}
          Save
        </Button>
      </div>

      <Tabs defaultValue="behaviour">
        <TabsList>
          <TabsTrigger value="behaviour">General</TabsTrigger>
          <TabsTrigger value="visibility">Display</TabsTrigger>
        </TabsList>

        <TabsContent
          value="visibility"
          className="grid items-start gap-5 md:grid-cols-2"
        >
          <div className="space-y-5">
            <SettingsSection title="Sites (scope)" hint={LIST_HINT}>
              <CheckList
                options={scopes.map((scope) => ({
                  value: scope.id,
                  label: scope.label,
                  detail: scope.path,
                }))}
                isChecked={(value) => draft.scopeIds.includes(value)}
                onToggle={(value, checked) =>
                  setDraft((prev) => ({
                    ...prev,
                    scopeIds: toggleIn(prev.scopeIds, value, checked),
                  }))
                }
              />
            </SettingsSection>

            <SettingsSection title="Languages" hint={LIST_HINT}>
              <CheckList
                options={languages.map((code) => ({
                  value: code,
                  label: code,
                }))}
                isChecked={(value) => draft.languages.includes(value)}
                onToggle={(value, checked) =>
                  setDraft((prev) => ({
                    ...prev,
                    languages: toggleIn(prev.languages, value, checked),
                  }))
                }
              />
            </SettingsSection>

            <SettingsSection title="Workflows" hint={LIST_HINT}>
              <CheckList
                options={workflows.map((workflow) => ({
                  value: workflow.workflowId,
                  label: workflow.displayName,
                }))}
                isChecked={(value) =>
                  draft.workflowIds.some((id) => idKey(id) === idKey(value))
                }
                onToggle={(value, checked) =>
                  setDraft((prev) => ({
                    ...prev,
                    workflowIds: checked
                      ? [...prev.workflowIds, value]
                      : prev.workflowIds.filter(
                          (id) => idKey(id) !== idKey(value),
                        ),
                  }))
                }
              />
            </SettingsSection>
          </div>

          <div className="space-y-5">
            <SettingsSection
              title="Switches"
              hint="Controls that are turned off disappear from the Workbox UI and fall back to their default behavior."
            >
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Switch
                    checked={draft.showRows}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        showRows: event.target.checked,
                      }))
                    }
                  />
                  Rows per page selector
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Switch
                    checked={draft.showOnlyMine}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        showOnlyMine: event.target.checked,
                      }))
                    }
                  />
                  Only my items filter
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Switch
                    checked={draft.showFinalStates}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        showFinalStates: event.target.checked,
                      }))
                    }
                  />
                  Show final states toggle
                </label>
              </div>
            </SettingsSection>
          </div>
        </TabsContent>

        <TabsContent
          value="behaviour"
          className="grid items-start gap-5 md:grid-cols-2"
        >
          <SettingsSection
            title="Pages &amp; Data sources"
            hint="How the list treats pages and their data sources. The last option adds a 'Show only pages' switch to the toolbar."
          >
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                  Pages display
                </span>
                <Select
                  value={draft.pageDisplay}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      pageDisplay: value as PageDisplayMode,
                    }))
                  }
                >
                  <SelectTrigger className="min-w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grouped">
                      Group data sources under their page (default)
                    </SelectItem>
                    <SelectItem value="pagesOnly">Show only pages</SelectItem>
                    <SelectItem value="flat">
                      Show pages and data sources as separate rows
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>

              {draft.pageDisplay !== "flat" && (
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Switch
                    checked={draft.commandsIncludeDatasources}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        commandsIncludeDatasources: event.target.checked,
                      }))
                    }
                  />
                  Commands on a page also run on its data sources (data sources
                  first, page last)
                  <span
                    title="Only the page's own data sources are included — the items under <page path>/data/. Shared data sources referenced from other locations are never affected."
                    className="inline-flex cursor-help text-text-subtle"
                  >
                    <Icon path={mdiInformationOutline} size={0.7} />
                  </span>
                </label>
              )}
            </div>
          </SettingsSection>

          <SettingsSection
            title="Scope"
            hint="Filters that are always applied. Their switches disappear from the toolbar."
          >
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Switch
                checked={draft.forceOnlyMine}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    forceOnlyMine: event.target.checked,
                  }))
                }
              />
              Always show only the user&apos;s own items
            </label>
          </SettingsSection>

          <SettingsSection
            title="Links"
            hint="Preview links are built automatically from the environment. If you have a dedicated preview site, set its URL here and preview links will use it with the same path as the live link."
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                Dedicated Preview URL
              </span>
              <Input
                value={draft.previewDomain}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    previewDomain: event.target.value,
                  }))
                }
                placeholder="preview.mysite.com"
                className="max-w-80"
              />
            </label>
          </SettingsSection>

          <SettingsSection
            title="Publish"
            hint="What happens when a command lands items in a final workflow state."
          >
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Switch
                checked={draft.autoPublish}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    autoPublish: event.target.checked,
                  }))
                }
              />
              Automatically publish when items reach a final state
            </label>
          </SettingsSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
