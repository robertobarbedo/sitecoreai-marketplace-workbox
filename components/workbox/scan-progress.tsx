import { mdiAlertOutline, mdiLoading } from "@mdi/js";

import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import type { ScanProgress as ScanProgressData } from "@/src/types/workbox";

export function ScanProgress({
  progress,
  isScanning,
  onCancel,
}: {
  progress: ScanProgressData | null;
  isScanning: boolean;
  onCancel: () => void;
}) {
  if (!progress) return null;

  if (isScanning) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border-muted bg-white p-4">
        <Icon path={mdiLoading} size={1} className="animate-spin text-primary" />
        <span className="text-sm text-text-subtle">
          Scanning&hellip; {progress.scanned.toLocaleString()}
          {progress.total > 0 ? ` of ${progress.total.toLocaleString()}` : ""}{" "}
          items read
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="ml-auto"
        >
          Stop
        </Button>
      </div>
    );
  }

  if (!progress.truncated) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning bg-warning-bg p-4 text-warning-fg">
      <Icon path={mdiAlertOutline} size={0.9} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-bold">Partial results</p>
        <p className="mt-0.5 text-sm">
          The scan stopped after {progress.scanned.toLocaleString()} of{" "}
          {progress.total.toLocaleString()} items. Pick a narrower scope (a
          single site) or a single language to see everything.
        </p>
      </div>
    </div>
  );
}
