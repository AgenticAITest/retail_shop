import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { useAuth } from '@client/provider/AuthProvider';
import axios from 'axios';
import { Lock, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface LockScreenProps {
  visible: boolean;
  onUnlock: () => void;
}

export default function LockScreen({ visible, onUnlock }: LockScreenProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!visible) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Re-authenticate with username + password
      await axios.post('/api/auth/login', {
        username: user?.username,
        password,
      });
      setPassword('');
      onUnlock();
    } catch {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card rounded-xl border shadow-2xl p-8 w-full max-w-[360px] mx-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-muted-foreground" />
        </div>

        <h2 className="text-xl font-bold mb-1">Session Locked</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {user?.fullname || user?.username || 'Cashier'}
        </p>

        <form onSubmit={handleUnlock} className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="Enter your password"
            className="h-12 text-center text-lg"
            autoFocus
            autoComplete="current-password"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full h-11" disabled={loading || !password}>
            {loading ? <Loader2 size={16} className="animate-spin mr-1" /> : <Lock size={16} className="mr-1" />}
            Unlock
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-4">
          Cart and shift are preserved while locked
        </p>
      </div>
    </div>
  );
}
