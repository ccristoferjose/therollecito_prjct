import type { Metadata } from 'next';
import ServicePeriodManagement from '@/features/service-period/service-period-management';
import MenuComposition from '@/features/service-period/menu-composition';

export const metadata: Metadata = {
  title: 'Service periods',
};

export default function AdminServicePeriodsPage() {
  return (
    <div className="space-y-10">
      <ServicePeriodManagement />
      {/* Which menu a period serves is only half the answer; this is the other
          half — which categories (and therefore products) each menu contains. */}
      <div className="border-t border-border pt-8">
        <MenuComposition />
      </div>
    </div>
  );
}
