import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Clock } from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import Button from '@shared/components/Button';
import Input from '@shared/components/Input';
import Card from '@shared/components/Card';

export default function StaffLoginPage() {
  const { login } = useStaffAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // Set by StaffAuthContext when a 401 forced us here. Read once, then clear so
  // it doesn't reappear on a later manual visit to the login page.
  const [sessionExpired] = useState(() => {
    const expired = sessionStorage.getItem('staff_session_expired') === '1';
    if (expired) sessionStorage.removeItem('staff_session_expired');
    return expired;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      // Route based on role
      if (data.user.role === 'admin') {
        navigate('/staff/admin');
      } else {
        navigate('/staff/kitchen');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-dark p-4">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img
            src="/icon_main.png"
            alt="The Rollecito"
            className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-[var(--shadow-warm)]"
          />
          <h1 className="mt-3 text-xl font-bold text-text">Staff Portal</h1>
          <p className="text-sm text-text-secondary">The Rollecito</p>
        </div>

        {sessionExpired && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <Clock size={16} className="shrink-0" />
            Your session expired. Please sign in again to keep receiving orders.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="staff@yumyum.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="rounded-lg bg-red-50 border border-error/20 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
            <Lock size={16} />
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
