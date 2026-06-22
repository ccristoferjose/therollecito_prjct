'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { ApiError } from '@/lib/api/client';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Card from '@/components/ui/card';

export default function StaffLoginPage() {
  const { login } = useStaffAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      router.replace(data.user.role === 'admin' ? '/staff/admin' : '/staff/kitchen');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-dark p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image
            src="/icon_main.png"
            alt="The Rollecito"
            width={80}
            height={80}
            className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-[var(--shadow-warm)]"
          />
          <h1 className="mt-3 text-xl font-bold text-text">Staff Portal</h1>
          <p className="text-sm text-text-secondary">The Rollecito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email" type="email" placeholder="staff@therollecito.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error">{error}</div>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
            <Lock size={16} />
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
