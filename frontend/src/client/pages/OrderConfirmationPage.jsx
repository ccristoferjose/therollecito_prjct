import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, ArrowRight, Search } from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useFetch } from '@shared/hooks/useFetch';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';
import { formatCurrency } from '@shared/utils/format';

export default function OrderConfirmationPage() {
  const { t } = useLang();
  const { orderId } = useParams();
  const { data: order, loading } = useFetch(`/orders/${orderId}`);

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
      <p className="mt-2 text-text-secondary">
        {t.confirmation.subtitle.replace('{id}', orderId)}
      </p>

      {order && (
        <Card className="mt-8 text-left">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-secondary">{t.confirmation.status}</span>
            <Badge status={order.status_name}>{order.status_name}</Badge>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-secondary">{t.confirmation.location}</span>
            <span className="text-sm font-medium text-text">{order.location_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">{t.confirmation.total}</span>
            <span className="text-sm font-bold text-primary-dark">
              {formatCurrency(order.total_amount)}
            </span>
          </div>
        </Card>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
          <Clock size={16} />
          {t.confirmation.readyNotice}
        </div>
        <Link to={`/track/${order?.tracking_code || orderId}`}>
          <Button variant="accent" className="w-full" size="lg">
            <Search size={16} /> {t.tracking.trackOrder}
          </Button>
        </Link>
        <Link to="/order">
          <Button variant="outline" className="w-full">
            {t.confirmation.orderMore} <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
