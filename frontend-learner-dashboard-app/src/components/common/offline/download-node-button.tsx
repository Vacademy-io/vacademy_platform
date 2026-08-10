/**
 * Per-node offline download affordance (plan §B7). Renders on subject/module/
 * chapter cards and per-slide rows. Reads live status from the offline store
 * (`useNodeOfflineStatus`) and drives `downloadManager` for actions.
 *
 * States: NOT_DOWNLOADED → download icon; QUEUED/DOWNLOADING → progress ring
 * + percent; DOWNLOADED → check; PARTIAL → half-filled check (some content is
 * online-only, per plan §7); UPDATE_AVAILABLE → refresh icon; ERROR →
 * warning + Retry; REMOVED_BY_ADMIN → notice, Delete-only.
 */

import { useEffect, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  CloudSlash,
  DotsThreeVertical,
  DownloadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNodeOfflineStatus, useOfflineUserId } from "@/hooks/offline/use-offline-status";
import { isOfflineSupported } from "@/lib/offline/platform";
import { downloadManager } from "@/lib/offline/download/download-manager";
import { slidesInSubtree, type ExpandableNodeType } from "@/lib/offline/download/expander";
import { getOfflineDb } from "@/lib/offline/db/connection";
import { nodesDao } from "@/lib/offline/db/dao/nodes-dao";
import { loadPersistedManifest } from "@/services/offline/manifest-service";
import { DeviceLimitReachedError, type OfflineDeviceDTO } from "@/services/offline/device-service";
import { DeviceLimitDialog } from "./device-limit-dialog";

export interface DownloadNodeButtonProps {
  nodeId: string;
  nodeType: ExpandableNodeType;
  packageSessionId: string | undefined | null;
  className?: string;
  /** Compact icon-only rendering for dense lists (chapter-sidebar-slides rows). */
  compact?: boolean;
}

export const DownloadNodeButton = ({
  nodeId,
  nodeType,
  packageSessionId,
  className,
  compact,
}: DownloadNodeButtonProps) => {
  const userId = useOfflineUserId();
  const status = useNodeOfflineStatus(nodeId);
  const [busy, setBusy] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [deviceLimitInfo, setDeviceLimitInfo] = useState<{ devices: OfflineDeviceDTO[]; message: string } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    if (!userId || (status !== "DOWNLOADING" && status !== "QUEUED")) {
      setProgressPercent(null);
      return;
    }
    (async () => {
      const db = await getOfflineDb();
      const node = await nodesDao.get(db, userId, nodeId);
      if (!cancelled && node && node.bytes_total > 0) {
        setProgressPercent(Math.min(100, Math.round((node.bytes_done / node.bytes_total) * 100)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, nodeId, status]);

  if (!isOfflineSupported() || !userId || !packageSessionId) return null;

  const handleDownload = async (allowCellular = false) => {
    setBusy(true);
    try {
      await downloadManager.enqueueNode(userId, packageSessionId, nodeId, nodeType, {
        allowCellular,
      });
    } catch (error) {
      if (error instanceof DeviceLimitReachedError) {
        setDeviceLimitInfo({ devices: error.devices, message: error.message });
      } else {
        console.error("[offline] failed to enqueue download", error);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = () => handleDownload();

  const handleUpdate = async () => {
    setBusy(true);
    try {
      await downloadManager.applyManifestUpdate(userId, packageSessionId);
    } catch (error) {
      console.error("[offline] failed to apply manifest update", error);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      const manifest = await loadPersistedManifest(userId, packageSessionId);
      const slideIds = manifest
        ? slidesInSubtree(manifest, nodeId, nodeType)
            .filter((ctx) => ctx.slide.downloadable)
            .map((ctx) => ctx.slide.slide_id)
        : [nodeId];
      await downloadManager.deleteNode(userId, packageSessionId, slideIds);
    } finally {
      setBusy(false);
    }
  };

  const handlePauseCancel = async () => {
    setBusy(true);
    try {
      const manifest = await loadPersistedManifest(userId, packageSessionId);
      const slideIds = manifest
        ? slidesInSubtree(manifest, nodeId, nodeType)
            .filter((ctx) => ctx.slide.downloadable)
            .map((ctx) => ctx.slide.slide_id)
        : [nodeId];
      await downloadManager.cancelNode(userId, packageSessionId, slideIds);
    } finally {
      setBusy(false);
    }
  };

  const iconSize = compact ? 16 : 20;
  const wrapperClass = cn(
    "inline-flex items-center justify-center rounded-full transition-colors",
    compact ? "size-6" : "size-8",
    className
  );

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  const effectiveStatus = status ?? "NOT_DOWNLOADED";

  const iconFor = () => {
    if (busy || effectiveStatus === "DOWNLOADING" || effectiveStatus === "QUEUED") {
      return (
        <span className={cn(wrapperClass, "relative text-primary-500")} title="Downloading…">
          <CircleNotch size={iconSize} className="animate-spin" />
          {!compact && progressPercent !== null && (
            <span className="absolute -bottom-4 text-3xs text-neutral-500">{progressPercent}%</span>
          )}
        </span>
      );
    }
    if (effectiveStatus === "DOWNLOADED") {
      return (
        <span className={cn(wrapperClass, "text-success-600")} title="Downloaded — available offline">
          <CheckCircle size={iconSize} weight="fill" />
        </span>
      );
    }
    if (effectiveStatus === "PARTIAL") {
      return (
        <span
          className={cn(wrapperClass, "text-warning-600")}
          title="Partially available offline (some content requires internet)"
        >
          <CheckCircle size={iconSize} />
        </span>
      );
    }
    if (effectiveStatus === "UPDATE_AVAILABLE") {
      return (
        <button
          type="button"
          onClick={(e) => {
            stopPropagation(e);
            void handleUpdate();
          }}
          className={cn(wrapperClass, "text-primary-500 hover:bg-primary-50")}
          title="Update available — tap to refresh"
        >
          <ArrowClockwise size={iconSize} />
        </button>
      );
    }
    if (effectiveStatus === "ERROR") {
      return (
        <button
          type="button"
          onClick={(e) => {
            stopPropagation(e);
            void handleRetry();
          }}
          className={cn(wrapperClass, "text-danger-600 hover:bg-danger-50")}
          title="Download failed — tap to retry"
        >
          <WarningCircle size={iconSize} />
        </button>
      );
    }
    if (effectiveStatus === "REMOVED_BY_ADMIN") {
      return (
        <span className={cn(wrapperClass, "text-neutral-400")} title="Removed by admin">
          <CloudSlash size={iconSize} />
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => {
          stopPropagation(e);
          void handleDownload();
        }}
        className={cn(wrapperClass, "text-neutral-500 hover:bg-neutral-100 hover:text-primary-600")}
        title="Download for offline use"
      >
        <DownloadSimple size={iconSize} />
      </button>
    );
  };

  const showKebab = effectiveStatus !== "NOT_DOWNLOADED";

  return (
    <div className="flex items-center gap-1" onClick={stopPropagation}>
      {iconFor()}
      {showKebab && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              title="Offline options"
            >
              <DotsThreeVertical size={16} weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(effectiveStatus === "DOWNLOADING" || effectiveStatus === "QUEUED") && (
              <DropdownMenuItem onClick={() => void handlePauseCancel()}>Cancel</DropdownMenuItem>
            )}
            {effectiveStatus === "ERROR" && (
              <DropdownMenuItem onClick={() => void handleRetry()}>Retry</DropdownMenuItem>
            )}
            {(effectiveStatus === "DOWNLOADED" ||
              effectiveStatus === "PARTIAL" ||
              effectiveStatus === "ERROR" ||
              effectiveStatus === "REMOVED_BY_ADMIN") && (
              <DropdownMenuItem onClick={() => void handleDelete()} className="text-danger-600">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {deviceLimitInfo && (
        <DeviceLimitDialog
          open={!!deviceLimitInfo}
          onOpenChange={(open) => !open && setDeviceLimitInfo(null)}
          devices={deviceLimitInfo.devices}
          message={deviceLimitInfo.message}
          onRetry={() => void handleDownload()}
        />
      )}
    </div>
  );
};
