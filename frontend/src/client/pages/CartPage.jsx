import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useCart } from '@shared/context/CartContext';
import { formatCurrency } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import EmptyState from '@shared/components/EmptyState';

export default function CartPage() {
  const { t } = useLang();
  const { items, total, itemCount, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState
          icon={ShoppingBag}
          title={t.cart.empty}
          description={t.cart.emptyDesc}
          action={
            <Link to="/order">
              <Button variant="primary">{t.cart.browseMenu}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-text">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-text">{t.cart.title}</h1>
        <span className="text-sm text-text-secondary">({itemCount} {t.cart.items})</span>
      </div>

      <div className="space-y-3">
        {items.map((entry) => (
          <Card key={entry.key} className="flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-primary-light to-primary/10 flex items-center justify-center overflow-hidden">
              {entry.item.image_url ? (
                <img src={entry.item.image_url} alt={entry.item.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">🍤</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-text truncate">{entry.item.name}</h3>
              {entry.options.length > 0 && (
                <p className="text-xs text-text-secondary mt-0.5">
                  {entry.options.map((o) => o.name).join(', ')}
                </p>
              )}
              <p className="text-sm font-semibold text-primary-dark mt-1">
                {formatCurrency(
                  (entry.item.price + entry.options.reduce((s, o) => s + (o.price_modifier || 0), 0)) *
                    entry.quantity
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(entry.key, entry.quantity - 1)}
                className="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-gray-50"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-sm font-medium">{entry.quantity}</span>
              <button
                onClick={() => updateQuantity(entry.key, entry.quantity + 1)}
                className="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-gray-50"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => removeItem(entry.key)}
                className="rounded-lg p-1.5 text-text-secondary hover:text-error hover:bg-red-50 ml-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card className="mt-6">
        <div className="flex items-center justify-between text-lg font-bold">
          <span className="text-text">{t.cart.total}</span>
          <span className="text-primary-dark">{formatCurrency(total)}</span>
        </div>
        <Link to="/checkout">
          <Button variant="accent" size="lg" className="w-full mt-4">
            {t.cart.checkout}
            <ArrowRight size={18} />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
