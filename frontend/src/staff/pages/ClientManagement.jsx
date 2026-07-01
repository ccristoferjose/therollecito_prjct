import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Search, Mail, Phone, ShoppingBag, DollarSign, Calendar,
  ChevronDown, ChevronRight, ExternalLink, X,
} from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency, formatDate, formatTime, formatOrderNumber } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Input from '@shared/components/Input';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

// Order statuses that count as "open" (still in the kitchen pipeline).
const OPEN_STATUSES = ['PAID', 'PREPARING', 'READY'];

function StatusBadge({ status }) {
  const label = status === 'CANCELED' ? 'canceled' : (status || '').toLowerCase();
  return <Badge status={status}>{label}</Badge>;
}

// -----------------------------------------------------------------------------
// Expandable per-client order history. Lazy-loaded the first time a client row
// is opened, then cached in the parent so re-expanding is instant.
// -----------------------------------------------------------------------------
function ClientOrders({ orders, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }
  if (!orders || orders.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-secondary">
        This client hasn't placed any orders yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text">{formatOrderNumber(order)}</span>
              <StatusBadge status={order.status_name} />
              <span className="text-xs text-text-secondary">{order.location_name}</span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {formatDate(order.created_at)} · {formatTime(order.created_at)}
            </p>
          </div>
          <span className="font-semibold text-text shrink-0">
            {formatCurrency(order.total_amount)}
          </span>
          {order.tracking_code && (
            <Link
              to={`/track/${order.tracking_code}`}
              target="_blank"
              className="rounded-lg p-2 text-text-secondary hover:bg-gray-100 hover:text-primary transition-colors shrink-0"
              title="Open tracking page"
            >
              <ExternalLink size={15} />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function ClientRow({ client, token, expanded, onToggle }) {
  // Lazy order fetch — only when this row is first expanded.
  const [ordersState, setOrdersState] = useState({ loading: false, orders: null, loaded: false });

  useEffect(() => {
    if (!expanded || ordersState.loaded || ordersState.loading) return;
    let cancelled = false;
    setOrdersState((s) => ({ ...s, loading: true }));
    api
      .get(`/users/clients/${client.id}/orders`, token)
      .then((data) => {
        if (cancelled) return;
        setOrdersState({ loading: false, orders: data.orders || [], loaded: true });
      })
      .catch(() => {
        if (cancelled) return;
        setOrdersState({ loading: false, orders: [], loaded: true });
      });
    return () => { cancelled = true; };
  }, [expanded, ordersState.loaded, ordersState.loading, client.id, token]);

  const openCount = (ordersState.orders || []).filter((o) =>
    OPEN_STATUSES.includes(o.status_name)
  ).length;

  return (
    <Card className={`overflow-hidden ${!client.is_active ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
          <Users size={18} className="text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-text truncate">
              {client.first_name} {client.last_name}
            </p>
            {!client.is_active && <Badge status="default">disabled</Badge>}
          </div>
          <p className="text-sm text-text-secondary truncate flex items-center gap-1">
            <Mail size={12} /> {client.email}
            {client.phone && (
              <>
                <span className="mx-1">·</span>
                <Phone size={12} /> {client.phone}
              </>
            )}
          </p>
        </div>

        {/* Aggregates — hidden on small screens to keep the row scannable. */}
        <div className="hidden md:flex items-center gap-6 text-sm shrink-0">
          <div className="text-right">
            <p className="font-semibold text-text flex items-center gap-1 justify-end">
              <ShoppingBag size={13} className="text-text-secondary" />
              {client.order_count}
            </p>
            <p className="text-[11px] text-text-secondary">orders</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-text flex items-center gap-1 justify-end">
              <DollarSign size={13} className="text-text-secondary" />
              {formatCurrency(client.total_spent)}
            </p>
            <p className="text-[11px] text-text-secondary">spent</p>
          </div>
          <div className="text-right min-w-[92px]">
            <p className="font-semibold text-text flex items-center gap-1 justify-end">
              <Calendar size={13} className="text-text-secondary" />
              {client.last_order_at ? formatDate(client.last_order_at) : '—'}
            </p>
            <p className="text-[11px] text-text-secondary">last order</p>
          </div>
        </div>

        <span className="shrink-0 text-text-secondary">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          {/* Compact aggregate strip for small screens */}
          <div className="md:hidden mb-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div><p className="font-semibold text-text">{client.order_count}</p><p className="text-[11px] text-text-secondary">orders</p></div>
            <div><p className="font-semibold text-text">{formatCurrency(client.total_spent)}</p><p className="text-[11px] text-text-secondary">spent</p></div>
            <div><p className="font-semibold text-text">{client.last_order_at ? formatDate(client.last_order_at) : '—'}</p><p className="text-[11px] text-text-secondary">last</p></div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-text">Order history</h4>
            {ordersState.loaded && openCount > 0 && (
              <span className="text-xs text-primary font-medium">
                {openCount} open order{openCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <ClientOrders orders={ordersState.orders} loading={ordersState.loading} />
          <p className="mt-3 text-[11px] text-text-secondary">
            Member since {formatDate(client.created_at)}
          </p>
        </div>
      )}
    </Card>
  );
}

export default function ClientManagement() {
  const { token } = useStaffAuth();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Debounce the search box → server-side filter (matches sp_client_list).
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const url = useMemo(
    () => `/users/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    [search]
  );
  const { data: clients, loading } = useFetch(url, token);
  const clientList = Array.isArray(clients) ? clients : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text">Clients</h2>
          <p className="text-sm text-text-secondary">
            Everyone who has signed into the platform. Open a client to see all their orders.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email or phone…"
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : clientList.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No clients match your search' : 'No clients yet'}
          description={
            search
              ? 'Try a different name, email or phone number.'
              : 'Clients appear here after they sign in and start ordering.'
          }
        />
      ) : (
        <div className="space-y-3">
          {clientList.map((client) => (
            <ClientRow
              key={client.id}
              client={client}
              token={token}
              expanded={expandedId === client.id}
              onToggle={() => setExpandedId((prev) => (prev === client.id ? null : client.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
