'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Plus, MapPin, RefreshCw } from 'lucide-react';
import { useLang } from '@/providers/lang-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { useCart } from '@/providers/cart-provider';
import { formatCurrency } from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import type { Location, MenuData, MenuItem, MenuItemOptionValue } from '@/lib/types';

const ORDER_PATH = '/order';

export default function OrderClient() {
  const { t } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlLocationId = searchParams.get('location');

  const { data: locations } = useFetch<Location[]>('/locations');
  const { addItem, itemCount, total, setLocation, locationId: cartLocationId } = useCart();

  const [pendingLocationId, setPendingLocationId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<MenuItemOptionValue[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  const effectiveLocationId = urlLocationId ? Number(urlLocationId) : cartLocationId;

  const setLocationParam = (locId: number | null, replace = false) => {
    const url = locId ? `${ORDER_PATH}?location=${locId}` : ORDER_PATH;
    if (replace) router.replace(url);
    else router.push(url);
  };

  // URL location differs from a non-empty cart → confirm; otherwise adopt it.
  useEffect(() => {
    if (urlLocationId && cartLocationId && Number(urlLocationId) !== cartLocationId && itemCount > 0) {
      setPendingLocationId(Number(urlLocationId));
    } else if (urlLocationId && (!cartLocationId || Number(urlLocationId) === cartLocationId)) {
      if (Number(urlLocationId) !== cartLocationId) setLocation(Number(urlLocationId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLocationId]);

  // Cart has a saved location but URL doesn't → reflect it in the URL.
  useEffect(() => {
    if (!urlLocationId && cartLocationId) setLocationParam(cartLocationId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: menuData, loading } = useFetch<MenuData>(
    effectiveLocationId ? `/menu/location/${effectiveLocationId}` : null,
  );

  useEffect(() => {
    if (menuData?.categories?.length && !activeCategory) {
      setActiveCategory(menuData.categories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuData]);

  function confirmLocationChange() {
    if (pendingLocationId !== null) setLocation(pendingLocationId);
    setPendingLocationId(null);
    setActiveCategory(null);
  }
  function cancelLocationChange() {
    setLocationParam(cartLocationId, true);
    setPendingLocationId(null);
  }
  function handleLocationPick(locId: number) {
    if (cartLocationId && locId !== cartLocationId && itemCount > 0) {
      setPendingLocationId(locId);
      setLocationParam(locId);
    } else {
      setLocation(locId);
      setLocationParam(locId);
    }
  }

  const currentLocationName = (locations || []).find((l) => l.id === effectiveLocationId)?.name;

  // No location chosen → location picker.
  if (!effectiveLocationId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-text">{t.menu.chooseLocation}</h1>
        <p className="mt-1 text-text-secondary">{t.menu.chooseLocationDesc}</p>
        {locations && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <div key={loc.id} onClick={() => handleLocationPick(loc.id)} className="cursor-pointer">
                <Card className="transition-colors hover:border-primary">
                  <h2 className="font-semibold text-text">{loc.name}</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {loc.address}, {loc.city}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];
  const options = menuData?.options || [];
  const optionValues = menuData?.optionValues || [];

  const filteredItems = activeCategory ? items.filter((i) => i.category_id === activeCategory) : items;
  const getItemOptions = (itemId: number) => options.filter((o) => o.item_id === itemId);
  const getOptionValues = (optionId: number) => optionValues.filter((v) => v.item_option_id === optionId);

  function handleAddToCart() {
    if (!selectedItem) return;
    addItem(selectedItem, selectedOptions, 1);
    setSelectedItem(null);
    setSelectedOptions([]);
  }
  function toggleOption(value: MenuItemOptionValue) {
    setSelectedOptions((prev) =>
      prev.find((o) => o.id === value.id) ? prev.filter((o) => o.id !== value.id) : [...prev, value],
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Modal open={pendingLocationId !== null} onClose={cancelLocationChange} title={t.menu.changeLocation}>
        <div className="space-y-4">
          <p className="text-sm text-text">{t.menu.changeLocationWarn}</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={cancelLocationChange}>
              {t.menu.keepCurrent}
            </Button>
            <Button variant="accent" className="flex-1" onClick={confirmLocationChange}>
              <RefreshCw size={14} /> {t.menu.changeConfirm}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t.menu.title}</h1>
          {currentLocationName && (
            <div className="mt-0.5 flex items-center gap-2">
              <MapPin size={14} className="text-primary" />
              <span className="text-sm font-medium text-primary-dark">{currentLocationName}</span>
              <button
                onClick={() => {
                  if (itemCount === 0) setLocation(null);
                  setLocationParam(null);
                }}
                className="text-xs text-text-secondary underline hover:text-text"
              >
                {t.menu.change}
              </button>
            </div>
          )}
        </div>
        {itemCount > 0 && (
          <Link href="/cart">
            <Button variant="accent" size="md">
              <ShoppingBag size={16} />
              {t.nav.cart} ({itemCount}) &middot; {formatCurrency(total)}
            </Button>
          </Link>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-white'
                  : 'border border-border bg-surface text-text-secondary hover:border-primary/40'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState title={t.menu.noItems} description={t.menu.noItemsDesc} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => {
                setSelectedItem(item);
                setSelectedOptions([]);
              }}
            >
              <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-light to-primary/10">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-4xl">🥐</span>
                )}
              </div>
              <h3 className="font-semibold text-text">{item.name}</h3>
              {item.description && (
                <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{item.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-primary-dark">{formatCurrency(item.price)}</span>
                <Button variant="primary" size="sm">
                  <Plus size={14} /> {t.menu.add}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.name || ''}>
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-light to-primary/10">
              {selectedItem.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedItem.image_url} alt={selectedItem.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-6xl">🥐</span>
              )}
            </div>
            {selectedItem.description && <p className="text-sm text-text-secondary">{selectedItem.description}</p>}
            <p className="text-xl font-bold text-primary-dark">{formatCurrency(selectedItem.price)}</p>

            {getItemOptions(selectedItem.id).map((opt) => (
              <div key={opt.id}>
                <h4 className="mb-2 text-sm font-medium text-text">
                  {opt.name}
                  {opt.is_required ? (
                    <Badge status="PREPARING" className="ml-2">
                      {t.menu.required}
                    </Badge>
                  ) : null}
                </h4>
                <div className="space-y-1">
                  {getOptionValues(opt.id).map((val) => (
                    <label
                      key={val.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selectedOptions.find((o) => o.id === val.id)}
                          onChange={() => toggleOption(val)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-text">{val.name}</span>
                      </div>
                      {val.price_modifier > 0 && (
                        <span className="text-sm text-text-secondary">+{formatCurrency(val.price_modifier)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <Button variant="accent" className="w-full" size="lg" onClick={handleAddToCart}>
              {t.menu.addToCart} &middot;{' '}
              {formatCurrency(
                selectedItem.price + selectedOptions.reduce((s, o) => s + (o.price_modifier || 0), 0),
              )}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
