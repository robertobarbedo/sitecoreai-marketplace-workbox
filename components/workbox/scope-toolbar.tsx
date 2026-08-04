"use client";

import { mdiCogOutline, mdiMagnify, mdiRefresh } from "@mdi/js";

import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_LANGUAGES, ROW_PAGE_SIZES } from "@/src/constants";
import type { ScanScope, WorkflowSummary } from "@/src/types/workbox";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}

export interface ScopeToolbarProps {
  scopes: ScanScope[];
  scopeId: string;
  onScopeChange: (scopeId: string) => void;
  /** False when the admin fixed a single scope — the input disappears. */
  showScope: boolean;
  languages: string[];
  language: string;
  onLanguageChange: (language: string) => void;
  /** False when the admin fixed a single language — the input disappears. */
  showLanguage: boolean;
  /** False when the admin limited the languages: "All languages" would leak past them. */
  allowAllLanguages: boolean;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  onlyPages: boolean;
  onOnlyPagesChange: (value: boolean) => void;
  showOnlyPages: boolean;
  onlyMine: boolean;
  onOnlyMineChange: (value: boolean) => void;
  showOnlyMine: boolean;
  includeFinal: boolean;
  onIncludeFinalChange: (value: boolean) => void;
  showIncludeFinal: boolean;
  rowPageSize: number;
  onRowPageSizeChange: (size: number) => void;
  showRows: boolean;
  workflows: WorkflowSummary[];
  selectedWorkflowId: string;
  onWorkflowChange: (workflowId: string) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  isScanning: boolean;
  userEmail: string;
}

export function ScopeToolbar({
  scopes,
  scopeId,
  onScopeChange,
  showScope,
  languages,
  language,
  onLanguageChange,
  showLanguage,
  allowAllLanguages,
  filterText,
  onFilterTextChange,
  onlyPages,
  onOnlyPagesChange,
  showOnlyPages,
  onlyMine,
  onOnlyMineChange,
  showOnlyMine,
  includeFinal,
  onIncludeFinalChange,
  showIncludeFinal,
  rowPageSize,
  onRowPageSizeChange,
  showRows,
  workflows,
  selectedWorkflowId,
  onWorkflowChange,
  onOpenSettings,
  onRefresh,
  isScanning,
  userEmail,
}: ScopeToolbarProps) {
  return (
    <div className="rounded-xl border border-border-muted bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Filter">
          <div className="relative">
            <Icon
              path={mdiMagnify}
              size={0.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
            />
            <Input
              value={filterText}
              onChange={(event) => onFilterTextChange(event.target.value)}
              placeholder="Name or path"
              className="min-w-[28rem] pl-9"
            />
          </div>
        </Field>

        <Field label="Scope">
          <Select
            value={scopeId}
            onValueChange={onScopeChange}
            disabled={!showScope}
          >
            <SelectTrigger className="min-w-52">
              <SelectValue placeholder="Select a scope" />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((scope) => (
                <SelectItem key={scope.id} value={scope.id}>
                  {scope.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Language">
          <Select
            value={language}
            onValueChange={onLanguageChange}
            disabled={!showLanguage}
          >
            <SelectTrigger className="min-w-36">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {allowAllLanguages && (
                <SelectItem value={ALL_LANGUAGES}>All languages</SelectItem>
              )}
              {languages.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {showRows && (
          <Field label="Rows">
            <Select
              value={String(rowPageSize)}
              onValueChange={(value) => onRowPageSizeChange(Number(value))}
            >
              <SelectTrigger className="min-w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROW_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={isScanning}
          className="ml-auto self-center"
        >
          <Icon path={mdiRefresh} size={0.9} />
          Refresh
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="self-center"
        >
          <Icon path={mdiCogOutline} size={1} />
        </Button>
      </div>

      {(workflows.length > 0 ||
        showOnlyPages ||
        showOnlyMine ||
        showIncludeFinal) && (
        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-border-muted pt-3">
          {workflows.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                Workflow
              </span>
              {workflows.length > 1 ? (
                <Select
                  value={selectedWorkflowId}
                  onValueChange={onWorkflowChange}
                >
                  <SelectTrigger className="min-w-56">
                    <SelectValue placeholder="Select a workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem
                        key={workflow.workflowId}
                        value={workflow.workflowId}
                      >
                        {workflow.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm font-bold text-on-surface">
                  {workflows[0].displayName}
                </span>
              )}
            </div>
          )}

          {showOnlyPages && (
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Switch
                checked={onlyPages}
                onChange={(event) => onOnlyPagesChange(event.target.checked)}
              />
              Show only pages
            </label>
          )}

          {showOnlyMine && (
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Switch
                checked={onlyMine}
                disabled={!userEmail}
                onChange={(event) => onOnlyMineChange(event.target.checked)}
              />
              Only my items
              {userEmail ? (
                <span className="text-xs text-text-subtle">({userEmail})</span>
              ) : (
                <span className="text-xs text-text-subtle">
                  (unavailable — no signed-in user)
                </span>
              )}
            </label>
          )}

          {showIncludeFinal && (
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Switch
                checked={includeFinal}
                onChange={(event) => onIncludeFinalChange(event.target.checked)}
              />
              Show final states
            </label>
          )}
        </div>
      )}
    </div>
  );
}
