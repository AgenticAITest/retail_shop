/**
 * Sync Scheduler Hook
 *
 * Schedules sync operations based on location's syncConfig.
 * Handles auto-sync on reconnect and manual sync triggers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { runFullSync, isSyncInProgress, type SyncProgress } from '../lib/syncEngine';
import { useOnlineStatus } from './useOfflineProducts';

interface UseSyncSchedulerOptions {
  locationId: string | null;
  syncConfig?: {
    frequency: string;
    windows: string[];
    autoSyncOnReconnect: boolean;
    manualSyncEnabled: boolean;
  } | null;
  enabled?: boolean;
}

export function useSyncScheduler({ locationId, syncConfig, enabled = true }: UseSyncSchedulerOptions) {
  const isOnline = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);
  const wasOfflineRef = useRef(false);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-sync on reconnect
  useEffect(() => {
    if (!enabled || !locationId) return;

    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current && syncConfig?.autoSyncOnReconnect) {
      wasOfflineRef.current = false;
      triggerSync();
    }
  }, [isOnline, enabled, locationId]);

  // Scheduled sync based on windows
  useEffect(() => {
    if (!enabled || !locationId || !syncConfig?.windows?.length) return;

    function checkSchedule() {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const window of syncConfig!.windows) {
        if (currentTime === window && isOnline && !isSyncInProgress()) {
          triggerSync();
          break;
        }
      }
    }

    // Check every minute
    schedulerRef.current = setInterval(checkSchedule, 60000);
    return () => { if (schedulerRef.current) clearInterval(schedulerRef.current); };
  }, [enabled, locationId, syncConfig, isOnline]);

  const triggerSync = useCallback(async () => {
    if (!locationId || !isOnline || syncing) return;

    setSyncing(true);
    setProgress(null);

    try {
      const result = await runFullSync(locationId, setProgress);
      setLastSyncResult(result);
    } catch {
      // Sync failed — will retry on next schedule
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }, [locationId, isOnline, syncing]);

  return {
    syncing,
    progress,
    lastSyncResult,
    triggerSync,
    isOnline,
  };
}
