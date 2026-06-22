import type { Metadata } from 'next';
import { Suspense } from 'react';
import OrderClient from '@/features/order/order-client';
import Spinner from '@/components/ui/spinner';

export const metadata: Metadata = {
  title: 'Order online',
  description: 'Browse the menu and order fresh-baked rolls online for pickup.',
};

// OrderClient reads ?location= via useSearchParams, which Next requires to sit
// under a Suspense boundary so the rest of the tree isn't forced to CSR.
export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      }
    >
      <OrderClient />
    </Suspense>
  );
}
