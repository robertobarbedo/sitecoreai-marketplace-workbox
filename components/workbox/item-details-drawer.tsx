"use client";

import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { mdiContentCopy, mdiLoading } from "@mdi/js";
import { useEffect, useState } from "react";

import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StateBadge, Tag } from "@/components/workbox/badges";
import { formatDate, formatUser, lastPathSegment } from "@/src/utils/format";
import { getItemFull } from "@/src/utils/sitecore-graphql";
import type { WorkboxItem, WorkboxItemFull } from "@/src/types/workbox";

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border-muted py-2 last:border-b-0">
      <span className="w-32 shrink-0 text-xs font-bold uppercase tracking-wider text-text-subtle">
        {label}
      </span>
      <span className="min-w-0 break-words text-sm text-on-surface">
        {value}
      </span>
    </div>
  );
}

export function ItemDetailsDrawer({
  item,
  client,
  sitecoreContextId,
  onClose,
  onCopy,
}: {
  item: WorkboxItem | null;
  client: ClientSDK | null;
  sitecoreContextId: string;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const [full, setFull] = useState<WorkboxItemFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item || !client || !sitecoreContextId) {
      setFull(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getItemFull(client, sitecoreContextId, item)
      .then((result) => {
        if (active) setFull(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [item, client, sitecoreContextId]);

  if (!item) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item.displayName || lastPathSegment(item.path)}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {item.path}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <StateBadge label={item.stateName} final={item.final} />
          <Tag>{item.workflowName}</Tag>
          <Tag mono>
            {item.language} v{item.version}
          </Tag>
        </div>

        <div>
          <MetaRow label="Template" value={item.templateName || "—"} />
          <MetaRow label="Item ID" value={<span className="font-mono text-xs">{item.itemId}</span>} />
          <MetaRow label="Updated" value={formatDate(item.updated)} />
          <MetaRow label="Updated by" value={formatUser(item.updatedBy)} />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(item.itemId, "Item ID")}
          >
            <Icon path={mdiContentCopy} size={0.8} />
            Copy item ID
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(item.path, "Item path")}
          >
            <Icon path={mdiContentCopy} size={0.8} />
            Copy path
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-subtle">
            Fields
          </p>

          {loading && (
            <div className="flex items-center gap-2 py-6 text-text-subtle">
              <Icon path={mdiLoading} size={0.9} className="animate-spin" />
              <span className="text-sm">Loading fields&hellip;</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-danger bg-danger-bg p-4 text-danger-fg">
              <p className="mb-1 font-bold">Could not load fields</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && full && full.fields.length === 0 && (
            <p className="py-4 text-sm text-text-subtle">
              This version has no own field values.
            </p>
          )}

          {!loading && !error && full && full.fields.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border-muted">
              <table className="w-full border-collapse text-left">
                <tbody>
                  {full.fields.map((field) => (
                    <tr
                      key={field.name}
                      className="border-b border-border-muted last:border-b-0"
                    >
                      <td className="w-48 px-3 py-2 align-top text-xs font-bold text-on-surface-variant">
                        {field.name}
                      </td>
                      <td className="px-3 py-2 align-top text-xs break-words text-on-surface">
                        {field.value || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
