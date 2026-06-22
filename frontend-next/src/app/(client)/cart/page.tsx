'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useLang } from '@/providers/lang-provider';
import { useCart } from '@/providers/cart-provider';
import { formatCurrency } from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';

export default function CartPage() {
  const { t } = useLang();
  const { items, total, itemCount, updateQuantity, removeItem } = useCart();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState
          icon={ShoppingBag}
          title={t.cart.empty}
          description={t.cart.emptyDesc}
          action={
            <Link href="/order">
              <Button variant="primary">{t.cart.browseMenu}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary hover:text-text" aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-text">{t.cart.title}</h1>
        <span className="text-sm text-text-secondary">
          ({itemCount} {t.cart.items})
        </span>
      </div>

      <div className="space-y-3">
        {items.map((entry) => (
          <Card key={entry.key} className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-light to-primary/10">
              {entry.item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.item.image_url} alt={entry.item.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">🥐</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-text">{entry.item.name}</h3>
              {entry.options.length > 0 && (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {entry.options.map((o) => o.name).filter(Boolean).join(', ')}
                </p>
              )}
              <p className="mt-1 text-sm font-semibold text-primary-dark">
                {formatCurrency(
                  (entry.item.price + entry.options.reduce((s, o) => s + (o.price_modifier || 0), 0)) *
                    entry.quantity,
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(entry.key, entry.quantity - 1)}
                className="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-gray-50"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-sm font-medium">{entry.quantity}</span>
              <button
                onClick={() => updateQuantity(entry.key, entry.quantity + 1)}
                className="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-gray-50"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => removeItem(entry.key)}
                className="ml-1 rounded-lg p-1.5 text-text-secondary hover:bg-red-50 hover:text-error"
                aria-label="Remove item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between text-lg font-bold">
          <span className="text-text">{t.cart.total}</span>
          <span className="text-primary-dark">{formatCurrency(total)}</span>
        </div>
        <Link href="/checkout">
          <Button variant="accent" size="lg" className="mt-4 w-full">
            {t.cart.checkout}
            <ArrowRight size={18} />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
