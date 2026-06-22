import type { Metadata } from 'next';
import ClientManagement from '@/features/clients/client-management';

export const metadata: Metadata = {
  title: 'Clients',
};

export default function AdminClientsPage() {
  return <ClientManagement />;
}
