import StaffShell from '@/features/staff/staff-shell';

// Authenticated staff area (admin + kitchen). The shell renders the sidebar
// and enforces the auth/role guard; /staff/login sits OUTSIDE this layout.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
