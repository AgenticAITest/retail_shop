import { Button } from '@client/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@client/components/ui/popover';
import { RefreshCw, Wifi, WifiOff, Database, Upload, AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus } from '../../hooks/useOfflineProducts';
import { fullCacheSync, getLastSyncTime } from '../../lib/cacheManager';
import { getQueueStats, pushPendingTransactions, runFullSync, type QueueStats } from '../../lib/syncEngine';

interface SyncStatusProps {
  locationId: string | null;
}

export default function SyncStatus({ locationId }: SyncStatusProps) {
  const isOnline = useOnlineStatus();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, syncing: 0, synced: 0, failed: 0, total: 0 });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getLastSyncTime().then(setLastSync).catch(() => {});
    refreshQueueStats();
  }, [syncing, open]);

  async function refreshQueueStats() {
    try { setQueueStats(await getQueueStats()); } catch {}
  }

  const handleFullSync = useCallback(async () => {
    if (!locationId || !isOnline || syncing) return;
    setSyncing(true);
    try {
      const result = await runFullSync(locationId);
      toast.success(`Sync complete: ${result.push.accepted} pushed, ${result.pull.products} products pulled`);
      setLastSync(new Date());
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
      refreshQueueStats();
    }
  }, [locationId, isOnline, syncing]);

  const handleForcePush = useCallback(async () => {
    if (!locationId || !isOnline || syncing) return;
    setSyncing(true);
    try {
      const result = await pushPendingTransactions(locationId);
      toast.success(`Pushed: ${result.accepted} accepted, ${result.rejected} rejected`);
    } catch {
      toast.error('Push failed');
    } finally {
      setSyncing(false);
      refreshQueueStats();
    }
  }, [locationId, isOnline, syncing]);

  const lastSyncStr = lastSync
    ? lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  const hasWarning = queueStats.pending >= 2000;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="pos-sync-status">
          {isOnline ? (
            <Wifi size={14} className="text-green-500" />
          ) : (
            <WifiOff size={14} className="text-red-500" />
          )}
          <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {queueStats.pending > 0 && (
            <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${hasWarning ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {queueStats.pending}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sync Status</span>
            <span className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Queue Stats */}
          <div className="text-xs space-y-1 bg-muted/50 rounded p-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending</span>
              <span className={`font-medium ${queueStats.pending > 0 ? 'text-yellow-600' : ''}`}>{queueStats.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Synced</span>
              <span className="font-medium text-green-600">{queueStats.synced}</span>
            </div>
            {queueStats.failed > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-medium text-red-600">{queueStats.failed}</span>
              </div>
            )}
          </div>

          {/* Warning */}
          {hasWarning && (
            <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
              <AlertTriangle size={12} />
              <span>Queue high ({queueStats.pending}). Sync soon!</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Database size={12} /> Last Sync
            </span>
            <span>{lastSyncStr}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8" onClick={handleFullSync} disabled={!isOnline || syncing || !locationId}>
              <RefreshCw size={12} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Full Sync'}
            </Button>
            {queueStats.pending > 0 && (
              <Button size="sm" variant="outline" className="h-8" onClick={handleForcePush} disabled={!isOnline || syncing}>
                <Upload size={12} className="mr-1" /> Push
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
