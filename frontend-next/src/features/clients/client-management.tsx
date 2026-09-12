'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users, Search, Mail, Phone, ShoppingBag, DollarSign, Calendar,
  ChevronDown, ChevronRight, ExternalLink, X,
} from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { api } from '@/lib/api/client';
import {
  formatCurrency, formatDate, formatTime, formatOrderNumber,
} from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import type { Client, ClientOrder, ClientOrdersResponse } from './types';

/** Statuses that still sit in the kitchen pipeline. */
const OPEN_STATUSES = ['PAID', 'PREPARING', 'READY'];

function StatusBadge({ status }: { status: string }) {
  const label = status === 'CANCELED' ? 'canceled' : (status || '').toLowerCase();
  return <Badge status={status}>{label}</Badge>;
}

function ClientOrders({ orders, loading }: { orders: ClientOrder[] | null; loading: boolean }) {
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
        This client hasn&apos;t placed any orders yet.
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
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-text">{formatOrderNumber(order)}</span>
              <StatusBadge status={order.status_name} />
              {order.location_name && (
                <span className="text-xs text-text-secondary">{order.location_name}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-text-secondary">
              {formatDate(order.created_at)} · {formatTime(order.created_at)}
            </p>
          </div>
          <span className="shrink-0 font-semibold text-text">
            {formatCurrency(Number(order.total_amount))}
          </span>
          {order.tracking_code && (
            <Link
              href={`/track/${order.tracking_code}`}
              target="_blank"
              className="shrink-0 rounded-lg p-2 text-text-secondary transition-colors hover:bg-gray-100 hover:text-primary"
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

function ClientRow({
  client,
  token,
  expanded,
  onToggle,
}: {
  client: Client;
  token: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Orders are fetched the first time the row is opened, then cached here so
  // re-expanding is instant and the list view stays cheap for large directories.
  const [ordersState, setOrdersState] = useState<{
    loading: boolean;
    orders: ClientOrder[] | null;
    loaded: boolean;
  }>({ loading: false, orders: null, loaded: false });

  useEffect(() => {
    if (!expanded || ordersState.loaded || ordersState.loading) return;
    let cancelled = false;
    setOrdersState((s) => ({ ...s, loading: true }));
    api
      .get<ClientOrdersResponse>(`/users/clients/${client.id}/orders`, token)
      .then((data) => {
        if (cancelled) return;
        setOrdersState({ loading: false, orders: data.orders || [], loaded: true });
      })
      .catch(() => {
        if (cancelled) return;
        setOrdersState({ loading: false, orders: [], loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, ordersState.loaded, ordersState.loading, client.id, token]);

  const openCount = (ordersState.orders || []).filter((o) =>
    OPEN_STATUSES.includes(o.status_name),
  ).length;

  return (
    <Card className={`overflow-hidden ${!client.is_active ? 'opacity-60' : ''}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
          <Users size={18} className="text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-text">
              {client.first_name} {client.last_name}
            </p>
            {!client.is_active && <Badge status="default">disabled</Badge>}
          </div>
          <p className="flex items-center gap-1 truncate text-sm text-text-secondary">
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
        <div className="hidden shrink-0 items-center gap-6 text-sm md:flex">
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 font-semibold text-text">
              <ShoppingBag size={13} className="text-text-secondary" />
              {client.order_count}
            </p>
            <p className="text-[11px] text-text-secondary">orders</p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 font-semibold text-text">
              <DollarSign size={13} className="text-text-secondary" />
              {formatCurrency(Number(client.total_spent))}
            </p>
            <p className="text-[11px] text-text-secondary">spent</p>
          </div>
          <div className="min-w-[92px] text-right">
            <p className="flex items-center justify-end gap-1 font-semibold text-text">
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
          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm md:hidden">
            <div>
              <p className="font-semibold text-text">{client.order_count}</p>
              <p className="text-[11px] text-text-secondary">orders</p>
            </div>
            <div>
              <p className="font-semibold text-text">{formatCurrency(Number(client.total_spent))}</p>
              <p className="text-[11px] text-text-secondary">spent</p>
            </div>
            <div>
              <p className="font-semibold text-text">
                {client.last_order_at ? formatDate(client.last_order_at) : '—'}
              </p>
              <p className="text-[11px] text-text-secondary">last</p>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text">Order history</h4>
            {ordersState.loaded && openCount > 0 && (
              <span className="text-xs font-medium text-primary">
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Debounced → server-side filter, matching sp_client_list's search.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const url = useMemo(
    () => `/users/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    [search],
  );
  const { data: clients, loading } = useFetch<Client[]>(url, token);
  const clientList = Array.isArray(clients) ? clients : [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Clients</h2>
          <p className="text-sm text-text-secondary">
            Everyone who has signed into the platform. Open a client to see all their orders.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email or phone…"
            aria-label="Search clients"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
