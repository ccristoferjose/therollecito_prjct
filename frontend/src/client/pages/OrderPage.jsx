import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, MapPin, RefreshCw } from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useFetch } from '@shared/hooks/useFetch';
import { useCart } from '@shared/context/CartContext';
import { formatCurrency } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import Modal from '@shared/components/Modal';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

export default function OrderPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlLocationId = searchParams.get('location');
  const { data: locations } = useFetch('/locations');
  const { addItem, itemCount, total, setLocation, locationId: cartLocationId } = useCart();

  const [pendingLocationId, setPendingLocationId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);

  // Resolve effective locationId: URL param > saved cart location
  const effectiveLocationId = urlLocationId ? Number(urlLocationId) : cartLocationId;

  // If URL has a location that differs from cart AND cart has items, ask to confirm
  useEffect(() => {
    if (urlLocationId && cartLocationId && Number(urlLocationId) !== cartLocationId && itemCount > 0) {
      setPendingLocationId(Number(urlLocationId));
    } else if (urlLocationId && (!cartLocationId || Number(urlLocationId) === cartLocationId)) {
      if (Number(urlLocationId) !== cartLocationId) {
        setLocation(Number(urlLocationId));
      }
    }
  }, [urlLocationId]);

  // If cart has a saved location but URL doesn't, set the URL to match
  useEffect(() => {
    if (!urlLocationId && cartLocationId) {
      setSearchParams({ location: cartLocationId }, { replace: true });
    }
  }, []);

  const { data: menuData, loading } = useFetch(
    effectiveLocationId ? `/menu/location/${effectiveLocationId}` : null
  );

  useEffect(() => {
    if (menuData?.categories?.length && !activeCategory) {
      setActiveCategory(menuData.categories[0].id);
    }
  }, [menuData]);

  function confirmLocationChange() {
    setLocation(pendingLocationId);
    setPendingLocationId(null);
    setActiveCategory(null);
  }

  function cancelLocationChange() {
    // Revert URL to the cart's location
    setSearchParams({ location: cartLocationId }, { replace: true });
    setPendingLocationId(null);
  }

  function handleLocationPick(locId) {
    if (cartLocationId && locId !== cartLocationId && itemCount > 0) {
      setPendingLocationId(locId);
      setSearchParams({ location: locId });
    } else {
      setLocation(locId);
      setSearchParams({ location: locId });
    }
  }

  const currentLocationName = (locations || []).find(
    (l) => l.id === effectiveLocationId
  )?.name;

  // If no location selected at all, show location picker
  if (!effectiveLocationId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-text">{t.menu.chooseLocation}</h1>
        <p className="mt-1 text-text-secondary">{t.menu.chooseLocationDesc}</p>
        {locations && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <div key={loc.id} onClick={() => handleLocationPick(loc.id)} className="cursor-pointer">
                <Card className="hover:border-primary transition-colors">
                  <h3 className="font-semibold text-text">{loc.name}</h3>
                  <p className="text-sm text-text-secondary mt-1">
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

  const filteredItems = activeCategory
    ? items.filter((i) => i.category_id === activeCategory)
    : items;

  const getItemOptions = (itemId) => options.filter((o) => o.item_id === itemId);
  const getOptionValues = (optionId) =>
    optionValues.filter((v) => v.item_option_id === optionId);

  function handleAddToCart() {
    if (!selectedItem) return;
    addItem(selectedItem, selectedOptions, 1);
    setSelectedItem(null);
    setSelectedOptions([]);
  }

  function toggleOption(value) {
    setSelectedOptions((prev) =>
      prev.find((o) => o.id === value.id)
        ? prev.filter((o) => o.id !== value.id)
        : [...prev, value]
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Location change confirmation modal */}
      <Modal
        open={!!pendingLocationId}
        onClose={cancelLocationChange}
        title={t.menu.changeLocation || 'Change Location?'}
      >
        <div className="space-y-4">
          <p className="text-sm text-text">
            {t.menu.changeLocationWarn || 'Changing location will clear your current cart. Do you want to continue?'}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={cancelLocationChange}>
              {t.menu.keepCurrent || 'Keep Current'}
            </Button>
            <Button variant="accent" className="flex-1" onClick={confirmLocationChange}>
              <RefreshCw size={14} /> {t.menu.changeConfirm || 'Change & Clear Cart'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">{t.menu.title}</h1>
          {currentLocationName && (
            <div className="flex items-center gap-2 mt-0.5">
              <MapPin size={14} className="text-primary" />
              <span className="text-sm text-primary-dark font-medium">{currentLocationName}</span>
              <button
                onClick={() => {
                  if (itemCount > 0) {
                    // Show location picker — clicking a new one triggers confirmation
                    setSearchParams({});
                  } else {
                    setLocation(null);
                    setSearchParams({});
                  }
                }}
                className="text-xs text-text-secondary underline hover:text-text"
              >
                {t.menu.change || 'change'}
              </button>
            </div>
          )}
        </div>
        {itemCount > 0 && (
          <Link to="/cart">
            <Button variant="accent" size="md">
              <ShoppingBag size={16} />
              {t.nav.cart} ({itemCount}) &middot; {formatCurrency(total)}
            </Button>
          </Link>
        )}
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-text-secondary hover:border-primary/40'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Items grid */}
      {filteredItems.length === 0 ? (
        <EmptyState title={t.menu.noItems} description={t.menu.noItemsDesc} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => {
                setSelectedItem(item);
                setSelectedOptions([]);
              }}
            >
              <div className="h-32 rounded-lg bg-gradient-to-br from-primary-light to-primary/10 mb-3 flex items-center justify-center overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-4xl">🍤</span>
                )}
              </div>
              <h3 className="font-semibold text-text">{item.name}</h3>
              {item.description && (
                <p className="mt-1 text-sm text-text-secondary line-clamp-2">{item.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-primary-dark">
                  {formatCurrency(item.price)}
                </span>
                <Button variant="primary" size="sm">
                  <Plus size={14} /> {t.menu.add}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Item detail modal */}
      <Modal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name || ''}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="h-40 rounded-xl bg-gradient-to-br from-primary-light to-primary/10 flex items-center justify-center overflow-hidden">
              {selectedItem.image_url ? (
                <img src={selectedItem.image_url} alt={selectedItem.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-6xl">🍤</span>
              )}
            </div>

            {selectedItem.description && (
              <p className="text-sm text-text-secondary">{selectedItem.description}</p>
            )}

            <p className="text-xl font-bold text-primary-dark">
              {formatCurrency(selectedItem.price)}
            </p>

            {/* Options */}
            {getItemOptions(selectedItem.id).map((opt) => (
              <div key={opt.id}>
                <h4 className="text-sm font-medium text-text mb-2">
                  {opt.name}
                  {opt.is_required ? (
                    <Badge status="PREPARING" className="ml-2">{t.menu.required}</Badge>
                  ) : null}
                </h4>
                <div className="space-y-1">
                  {getOptionValues(opt.id).map((val) => (
                    <label
                      key={val.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:border-primary/40 transition-colors"
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
                        <span className="text-sm text-text-secondary">
                          +{formatCurrency(val.price_modifier)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <Button variant="accent" className="w-full" size="lg" onClick={handleAddToCart}>
              {t.menu.addToCart} &middot;{' '}
              {formatCurrency(
                selectedItem.price +
                  selectedOptions.reduce((s, o) => s + (o.price_modifier || 0), 0)
              )}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
