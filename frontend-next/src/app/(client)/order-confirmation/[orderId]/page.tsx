'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle, Clock, ArrowRight, Search } from 'lucide-react';
import { useLang } from '@/providers/lang-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { formatCurrency } from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import type { Order } from '@/lib/types';

export default function OrderConfirmationPage() {
  const { t } = useLang();
  const params = useParams<{ orderId: string }>();
  const orderId = String(params.orderId ?? '');
  const { data: order, loading } = useFetch<Order>(orderId ? `/orders/${orderId}` : null);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
        <CheckCircle size={32} className="text-success" />
      </div>

      <h1 className="text-2xl font-bold text-text">{t.confirmation.title}</h1>
      <p className="mt-2 text-text-secondary">{t.confirmation.subtitle.replace('{id}', orderId)}</p>

      {order && (
        <Card className="mt-8 text-left">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-text-secondary">{t.confirmation.status}</span>
            <Badge status={order.status_name}>{order.status_name}</Badge>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-text-secondary">{t.confirmation.location}</span>
            <span className="text-sm font-medium text-text">{order.location_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">{t.confirmation.total}</span>
            <span className="text-sm font-bold text-primary-dark">{formatCurrency(order.total_amount)}</span>
          </div>
        </Card>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
          <Clock size={16} />
          {t.confirmation.readyNotice}
        </div>
        <Link href={`/track/${order?.tracking_code || orderId}`}>
          <Button variant="accent" className="w-full" size="lg">
            <Search size={16} /> {t.tracking.trackOrder}
          </Button>
        </Link>
        <Link href="/order">
          <Button variant="outline" className="w-full">
            {t.confirmation.orderMore} <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
