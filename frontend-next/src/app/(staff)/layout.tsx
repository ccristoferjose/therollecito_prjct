import type { Metadata } from 'next';
import { StaffAuthProvider } from '@/providers/staff-auth-provider';

/**
 * INTERNAL staff/admin layout — login, admin dashboard, kitchen. Always
 * noindex (private), isolated from the client/marketing surfaces. The
 * StaffAuth provider is mounted here; per-page route guards use useStaffAuth.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffAuthProvider>
      <div className="min-h-screen">{children}</div>
    </StaffAuthProvider>
  );
}
