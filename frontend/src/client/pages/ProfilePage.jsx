import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ShoppingBag, LogIn, LogOut, Mail, Clock, ChevronRight, MapPin, RotateCcw, CheckCircle } from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useClientAuth } from '@shared/context/ClientAuthContext';
import { useCart } from '@shared/context/CartContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency, formatDate, formatOrderNumber } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import Modal from '@shared/components/Modal';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

export default function ProfilePage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { isAuthenticated, firebaseUser, user, token, loading, signInWithGoogle, signOut } =
    useClientAuth();
  const { setLocation, addItem, itemCount } = useCart();
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [reorderConfirm, setReorderConfirm] = useState(null); // { order } when cart replacement needs confirmation
  const [reordering, setReordering] = useState(false);
  const [toast, setToast] = useState(null); // { message }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Resolves a past order's items against the CURRENT menu for that
  // order's location, populates the cart with whatever still exists,
  // and navigates to the order page so the user can edit before checkout.
  async function performReorder(order) {
    setReordering(true);
    try {
      const [itemsRes, menuRes] = await Promise.all([
        api.get(`/orders/${order.id}/items`, token),
        api.get(`/menu/location/${order.location_id}`),
      ]);

      const pastItems = itemsRes?.items || [];
      const pastOptions = itemsRes?.itemOptions || [];
      const currentItems = menuRes?.items || [];
      const currentOptionValues = menuRes?.optionValues || [];

      const itemById = new Map(currentItems.map((i) => [i.id, i]));
      const valueById = new Map(currentOptionValues.map((v) => [v.id, v]));

      let added = 0;
      let skipped = 0;

      // Reset cart to the past order's location (this clears existing items)
      setLocation(order.location_id);

      for (const pastItem of pastItems) {
        const currentItem = itemById.get(pastItem.item_id);
        if (!currentItem) {
          skipped += 1;
          continue;
        }

        const matchedOptions = pastOptions
          .filter((o) => o.order_item_id === pastItem.id)
          .map((o) => valueById.get(o.item_option_value_id))
          .filter(Boolean);

        addItem(currentItem, matchedOptions, pastItem.quantity);
        added += 1;
      }

      if (added === 0) {
        setToast({ message: 'None of these items are available anymore.' });
        setReordering(false);
        setReorderConfirm(null);
        return;
      }

      const skippedMsg = skipped > 0
        ? ` ${skipped} item${skipped !== 1 ? 's' : ''} unavailable and skipped.`
        : '';
      setToast({ message: `${added} item${added !== 1 ? 's' : ''} added to your cart.${skippedMsg}` });
      setReorderConfirm(null);
      navigate(`/order?location=${order.location_id}`);
    } catch (err) {
      setToast({ message: err?.message || 'Failed to reorder. Please try again.' });
    } finally {
      setReordering(false);
    }
  }

  function handleReorderClick(e, order) {
    e.preventDefault();
    e.stopPropagation();
    if (itemCount > 0) {
      setReorderConfirm({ order });
      return;
    }
    performReorder(order);
  }

  async function handleSignIn() {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSigningIn(false);
    }
  }

  // Fetch order history only if authenticated
  const { data: orders, loading: ordersLoading } = useFetch(
    isAuthenticated ? '/orders' : null,
    token
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not signed in
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold text-text mb-6">{t.profile.title}</h1>

        <Card className="text-center py-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <User size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-text">{t.profile.signIn}</h2>
          <p className="mt-1 text-sm text-text-secondary max-w-sm mx-auto">
            {t.profile.signInDesc}
          </p>
          {authError && (
            <div className="mt-4 rounded-lg bg-red-50 border border-error/20 p-3 text-sm text-error">
              {authError}
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            className="mt-6"
            onClick={handleSignIn}
            disabled={signingIn}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t.profile.signInButton}
          </Button>
        </Card>
      </div>
    );
  }

  // Signed in
  const orderList = Array.isArray(orders) ? orders : [];
  const activeStatuses = ['PAID', 'PREPARING', 'READY'];
  const activeOrders = orderList.filter((o) => activeStatuses.includes(o.status_name));
  const pastOrders = orderList.filter((o) => !activeStatuses.includes(o.status_name));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-text mb-6">{t.profile.title}</h1>

      {/* User card */}
      <Card className="flex items-center gap-4">
        {firebaseUser?.photoURL ? (
          <img
            src={firebaseUser.photoURL}
            alt=""
            className="h-14 w-14 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <User size={28} className="text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text truncate">
            {firebaseUser?.displayName || user?.first_name}
          </p>
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <Mail size={14} />
            <span className="truncate">{firebaseUser?.email}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0">
          <LogOut size={16} />
        </Button>
      </Card>

      {ordersLoading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!ordersLoading && orderList.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={ShoppingBag}
            title={t.profile.noOrders}
            description={t.profile.noOrdersDesc}
          />
        </div>
      )}

      {/* Active orders — prominent */}
      {activeOrders.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-text mb-3 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            {t.profile.activeOrders || 'Active Orders'}
          </h2>
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <Link key={order.id} to={`/track/${order.tracking_code}`}>
                <Card className="flex items-center gap-4 border-primary/30 bg-primary-light/20 hover:border-primary/50 transition-colors cursor-pointer">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light">
                    <ShoppingBag size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text">{formatOrderNumber(order)}</span>
                      <Badge status={order.status_name}>{order.status_name}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {order.location_name}
                      </span>
                      <span>{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                  <Button variant="primary" size="sm" className="shrink-0">
                    {t.tracking?.trackOrder || 'Track'}
                  </Button>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reorder confirmation modal */}
      <Modal
        open={!!reorderConfirm}
        onClose={reordering ? () => {} : () => setReorderConfirm(null)}
        title="Replace your cart?"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Your current cart has {itemCount} item{itemCount !== 1 ? 's' : ''}. Reordering will
            replace it with the items from order <strong>{reorderConfirm?.order ? formatOrderNumber(reorderConfirm.order) : ''}</strong>.
            You'll be able to edit the cart before checking out.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setReorderConfirm(null)}
              disabled={reordering}
            >
              Keep current cart
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => performReorder(reorderConfirm.order)}
              disabled={reordering}
            >
              <RotateCcw size={14} />
              {reordering ? 'Reordering...' : 'Replace & reorder'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-white shadow-lg border border-border px-4 py-3 max-w-sm">
          <div className="flex items-start gap-2">
            <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-text">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Past orders */}
      {pastOrders.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-text mb-3">
            {t.profile.recentOrders}
          </h2>
          <div className="space-y-3">
            {pastOrders.map((order) => (
              <Link key={order.id} to={`/track/${order.tracking_code}`}>
                <Card className="flex items-center gap-4 hover:border-primary/40 transition-colors cursor-pointer">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <ShoppingBag size={18} className="text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">{formatOrderNumber(order)}</span>
                      <Badge status={order.status_name}>{order.status_name}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                      <span>{order.location_name}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-text-secondary shrink-0">
                    {formatCurrency(order.total_amount)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleReorderClick(e, order)}
                    disabled={reordering}
                    className="shrink-0"
                  >
                    <RotateCcw size={14} />
                    Reorder
                  </Button>
                  <ChevronRight size={16} className="text-text-secondary shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
