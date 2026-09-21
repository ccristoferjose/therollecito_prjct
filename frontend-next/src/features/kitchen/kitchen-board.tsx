'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock, ChefHat, Bell, CheckCircle, Volume2, VolumeX, AlertTriangle,
  User, Timer, MapPin, CreditCard, RotateCcw, XCircle, Flame, MoreVertical, ArrowRight, Package,
  MessageSquare, Phone, Mail, Clock3,
} from 'lucide-react';
import Modal from '@/components/ui/modal';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { useSocket } from '@/lib/hooks/use-socket';
import { api, ApiError } from '@/lib/api/client';
import { formatCurrency, formatOrderNumber, formatWhen } from '@/lib/utils/format';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import type { Location } from '@/lib/types';
import type { KitchenOrder, KitchenColumn, KitchenBoardResponse } from '@/features/kitchen/types';
import KitchenScheduleStrip from '@/features/kitchen/kitchen-schedule-strip';

const COLUMNS: KitchenColumn[] = [
  { status: 'PAID', label: 'New Orders', icon: Clock, nextStatus: 'PREPARING', nextAction: 'Start', nextIcon: ChefHat, headerBg: 'bg-[#F2D6B3]', headerText: 'text-primary-dark', accent: 'border-t-4 border-t-[#A86A4A]', dot: 'bg-[#A86A4A]' },
  { status: 'PREPARING', label: 'In Progress', icon: ChefHat, nextStatus: 'READY', nextAction: 'Mark Ready', nextIcon: Bell, headerBg: 'bg-[#F4A261]', headerText: 'text-primary-dark', accent: 'border-t-4 border-t-[#F4A261]', dot: 'bg-[#F4A261]' },
  { status: 'READY', label: 'Ready for Pickup', icon: Bell, nextStatus: 'COMPLETED', nextAction: 'Complete', nextIcon: CheckCircle, headerBg: 'bg-[#6B8E4E]', headerText: 'text-white', accent: 'border-t-4 border-t-[#6B8E4E]', dot: 'bg-[#6B8E4E]' },
];

const getWaitMinutes = (createdAt: string) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

function WaitTimer({ createdAt }: { createdAt: string }) {
  const [minutes, setMinutes] = useState(() => getWaitMinutes(createdAt));
  useEffect(() => {
    const interval = setInterval(() => setMinutes(getWaitMinutes(createdAt)), 15000);
    return () => clearInterval(interval);
  }, [createdAt]);
  const urgent = minutes >= 10;
  const warning = minutes >= 5 && minutes < 10;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${urgent ? 'animate-pulse bg-red-100 text-red-700' : warning ? 'bg-amber-100 text-amber-800' : 'bg-white/70 text-primary-dark'}`}>
      {urgent && <AlertTriangle size={14} />}
      <Timer size={14} />
      {minutes}m
    </span>
  );
}

function PaymentBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    succeeded: 'bg-green-50 text-green-700 border-green-200',
    refunded: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[status] || 'border-gray-200 bg-gray-50 text-text-secondary'}`}>
      <CreditCard size={12} />
      {status}
    </span>
  );
}

function PriorityBadge() {
  return (
    <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-bold uppercase text-red-700">
      <Flame size={12} />
      Priority
    </span>
  );
}

function KanbanCard({
  order,
  column,
  expanded,
  nowMs,
  onSelect,
  onAdvance,
  onPrioritize,
  onCancel,
}: {
  order: KitchenOrder;
  column: KitchenColumn;
  expanded: boolean;
  nowMs: number | null;
  onSelect: (id: number) => void;
  onAdvance: (id: number, nextStatus: string) => Promise<void>;
  onPrioritize: (order: KitchenOrder) => void;
  onCancel: (order: KitchenOrder) => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [menuOpen]);

  async function handleAdvance(e?: React.SyntheticEvent) {
    e?.stopPropagation();
    setAdvancing(true);
    try {
      await onAdvance(order.id, column.nextStatus);
    } finally {
      setAdvancing(false);
    }
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const itemCount = order.items?.length || 0;

  // Mirrors the Vite kitchen card. A registered customer has no guest_name, so
  // fall back to their account name rather than showing "Registered User".
  const registeredName = [order.user_first_name, order.user_last_name].filter(Boolean).join(' ');
  const customerName = order.guest_name || registeredName || 'Registered customer';
  const customerPhone = order.guest_phone || order.user_phone || null;
  const customerEmail = order.user_email || null;

  // Order-level comment (checkout "special instructions"), distinct from the
  // per-item notes rendered inside the items list.
  const orderComment = order.notes && order.notes.trim() ? order.notes.trim() : null;
  // Total selected options across the order — surfaced on the collapsed card so
  // staff can see at a glance that an order has customisations to read.
  const toppingsCount = (order.items || []).reduce((n, it) => n + (it.options?.length || 0), 0);

  return (
    <article
      onClick={() => onSelect(order.id)}
      className={`relative cursor-pointer overflow-hidden rounded-2xl bg-surface transition-all duration-150 ${column.accent} ${order.is_priority ? 'ring-2 ring-red-400' : ''} ${expanded ? 'shadow-[var(--shadow-elevated)] ring-2 ring-primary/40' : 'shadow-[var(--shadow-card)] hover:shadow-md'}`}
    >
      <div className={`flex items-start justify-between px-4 ${expanded ? 'pt-4 pb-2' : 'py-2.5'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-extrabold text-primary-dark ${expanded ? 'text-2xl' : 'text-xl'}`}>{formatOrderNumber(order)}</span>
          <WaitTimer createdAt={order.created_at} />
          {!expanded && (
            <span className="text-xs font-semibold text-text-secondary">
              · {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {expanded && (
          <div className="relative" ref={menuRef} onClick={stop}>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setMenuOpen((v) => !v);
              }}
              aria-label="More actions"
              className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-full text-primary-dark/70 transition-colors hover:bg-primary-light/50 active:bg-primary-light/80"
            >
              <MoreVertical size={22} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-20 min-w-[210px] overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-[var(--shadow-elevated)]">
                {column.status !== 'PAID' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      setMenuOpen(false);
                      onPrioritize(order);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-base font-semibold text-amber-800 hover:bg-amber-50 active:bg-amber-100"
                  >
                    <RotateCcw size={18} />
                    Send back to queue
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    setMenuOpen(false);
                    onCancel(order);
                  }}
                  className="flex w-full items-center gap-3 border-t border-border/60 px-4 py-3.5 text-left text-base font-semibold text-red-700 hover:bg-red-50 active:bg-red-100"
                >
                  <XCircle size={18} />
                  Cancel &amp; refund
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <>
          {(order.is_priority || order.payment_status) && (
            <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
              {order.is_priority ? <PriorityBadge /> : null}
              <PaymentBadge status={order.payment_status} />
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2 text-sm">
            <User size={16} className="shrink-0 text-text-secondary" />
            <span className="truncate font-semibold text-primary-dark">{customerName}</span>
            {order.pickup_time && (
              <span className="ml-auto text-xs font-semibold text-text-secondary">
                Pickup {formatWhen(order.pickup_time, nowMs ?? undefined)}
              </span>
            )}
          </div>

          {/* Why this order is on the board now. Only worth saying when the
              kitchen has a real lead time to respect — an ASAP order has no
              prepare_at distinct from when it was placed. */}
          {order.prepare_at && order.pickup_time && (
            <div className="flex items-center gap-1.5 px-4 pb-2 text-xs font-semibold text-[#A86A4A]">
              <Clock3 size={13} className="shrink-0" />
              Start prep {formatWhen(order.prepare_at, nowMs ?? undefined)}
            </div>
          )}

          {/* Contact details — the kitchen needs a way to reach the customer
              about a missing item or a note it cannot fulfil. */}
          {(customerPhone || customerEmail) && (
            <div className="flex flex-wrap items-center gap-3 px-4 pb-2 text-xs text-text-secondary">
              {customerPhone && (
                <a href={`tel:${customerPhone}`} className="inline-flex items-center gap-1 hover:text-primary">
                  <Phone size={12} /> {customerPhone}
                </a>
              )}
              {customerEmail && (
                <a href={`mailto:${customerEmail}`} className="inline-flex items-center gap-1 truncate hover:text-primary">
                  <Mail size={12} /> {customerEmail}
                </a>
              )}
            </div>
          )}

          {/* ORDER-LEVEL note from checkout. High-contrast callout so the
              kitchen never misses it — this is separate from per-item notes
              rendered further down. */}
          {orderComment && (
            <div className="mx-4 mb-1 mt-1 rounded-xl border-2 border-accent/40 bg-accent/10 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-accent-hover" />
                <p className="text-[11px] font-bold uppercase tracking-wide text-accent-hover">
                  Customer note
                </p>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm font-semibold text-primary-dark">
                {orderComment}
              </p>
            </div>
          )}

          <div className="space-y-2.5 border-t border-border/60 bg-[#FFF1DC]/40 px-4 py-3">
            {(order.items || []).map((item) => (
              <div key={item.id} className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-text-inverse">{item.quantity}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-tight text-primary-dark">{item.item_name}</p>
                  {item.options && item.options.length > 0 && (
                    <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">+ Toppings ({item.options.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.options.map((opt) => (
                          <span key={opt.id} className="inline-flex items-center rounded-md border border-amber-300 bg-white px-2 py-0.5 text-sm font-bold text-amber-900">
                            {opt.option_value_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.notes && <p className="mt-1 text-sm font-semibold text-accent-hover">⚠ {item.notes}</p>}
                </div>
              </div>
            ))}
          </div>

          {order.is_priority && order.priority_reason && (
            <div className="border-t border-red-200 bg-red-50 px-4 py-2">
              <p className="text-sm text-red-800">
                <strong>Sent back:</strong> {order.priority_reason}
              </p>
            </div>
          )}
        </>
      )}

      {!expanded && (
        <div className="flex items-center justify-between gap-2 px-4 pb-2.5 text-sm">
          <span className="flex items-center gap-1.5 truncate font-semibold text-primary-dark">
            <User size={14} className="shrink-0 text-text-secondary" />
            {customerName}
            {order.is_priority && <Flame size={14} className="shrink-0 text-red-600" />}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {/* Quick indicators so a collapsed card still signals that there is
                something to read before starting the order. */}
            {orderComment && (
              <span className="inline-flex items-center gap-0.5 text-accent-hover" title="Customer note">
                <MessageSquare size={14} />
              </span>
            )}
            {toppingsCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 font-semibold text-amber-700"
                title={`${toppingsCount} topping${toppingsCount !== 1 ? 's' : ''}`}
              >
                <Package size={14} />
                {toppingsCount}
              </span>
            )}
            <span className="text-base font-extrabold text-primary">{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
      )}

      <div className={`px-4 ${expanded ? 'border-t border-border/60 pt-3 pb-4' : 'pb-3'}`}>
        {expanded && (
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              <Package size={14} className="-mt-0.5 mr-1 inline" />
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
            <span className="text-lg font-extrabold text-primary">{formatCurrency(order.total_amount)}</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleAdvance}
          disabled={advancing}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-text-inverse shadow-[var(--shadow-warm)] transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${expanded ? 'min-h-[56px] text-lg' : 'min-h-[44px] text-base'}`}
        >
          {advancing ? (
            <Spinner size="sm" />
          ) : (
            <>
              <column.nextIcon size={expanded ? 22 : 18} />
              {column.nextAction}
              <ArrowRight size={expanded ? 20 : 16} />
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function KanbanColumn({
  column,
  orders,
  loading,
  nowMs,
  selectedOrderId,
  onSelect,
  onAdvance,
  onPrioritize,
  onCancel,
}: {
  column: KitchenColumn;
  orders: KitchenOrder[];
  loading: boolean;
  nowMs: number | null;
  selectedOrderId: number | null;
  onSelect: (id: number) => void;
  onAdvance: (id: number, nextStatus: string) => Promise<void>;
  onPrioritize: (order: KitchenOrder) => void;
  onCancel: (order: KitchenOrder) => void;
}) {
  const Icon = column.icon;
  return (
    <section className="flex min-w-[300px] flex-1 flex-col overflow-hidden rounded-2xl bg-[#FFF1DC]/80">
      <header className={`flex items-center justify-between px-4 py-3 shadow-sm ${column.headerBg} ${column.headerText}`}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/30">
            <Icon size={18} />
          </span>
          <h3 className="text-base font-bold uppercase tracking-wide">{column.label}</h3>
        </div>
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white/90 px-2.5 text-sm font-extrabold text-primary-dark">{orders.length}</span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto scroll-smooth p-3">
        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <span className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full ${column.dot} opacity-20`} />
            <p className="text-base font-semibold text-primary-dark/70">No orders here</p>
            <p className="mt-1 text-sm text-primary-dark/50">New orders will appear automatically.</p>
          </div>
        ) : (
          orders.map((order) => (
            <KanbanCard
              key={order.id}
              order={order}
              column={column}
              expanded={order.id === selectedOrderId}
              nowMs={nowMs}
              onSelect={onSelect}
              onAdvance={onAdvance}
              onPrioritize={onPrioritize}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function KitchenBoard() {
  const { token, user } = useStaffAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(user?.location_id || null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [priorityModal, setPriorityModal] = useState<{ order: KitchenOrder } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ order: KitchenOrder } | null>(null);
  const [modalReason, setModalReason] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const isAdmin = user?.role === 'admin';
  const locationId = isAdmin ? selectedLocationId : user?.location_id;
  const { data: locations } = useFetch<Location[]>(isAdmin ? '/locations' : null, token);

  useEffect(() => {
    if (isAdmin && !selectedLocationId && locations && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [isAdmin, selectedLocationId, locations]);

  // One call for the whole board. It returns orders already bucketed by
  // `prepare_at`, so a scheduled order for tomorrow never lands in New Orders.
  const boardFetch = useFetch<KitchenBoardResponse>(
    locationId ? `/kitchen/board?location_id=${locationId}` : null,
    token,
  );
  const board = boardFetch.data;
  const anyLoading = boardFetch.loading;
  const refetchAll = boardFetch.refetch;

  // Offset between the server clock and this tablet's clock. Bucket boundaries
  // are the server's, so a device with a skewed clock must not shift them.
  const [serverOffset, setServerOffset] = useState(0);
  useEffect(() => {
    if (board?.server_time) {
      setServerOffset(Date.parse(board.server_time) - Date.now());
    }
  }, [board?.server_time]);

  // Server-corrected wall clock, ticked locally. Between polls an order can
  // reach its prepare_at, and the board promotes it from Upcoming to the queue
  // without waiting for the next fetch. Held in state rather than read during
  // render so the first paint matches the server's own bucketing.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNowMs(Date.now() + serverOffset);
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, [serverOffset]);

  const { queue, upcoming } = useMemo(() => {
    if (!board) return { queue: [] as KitchenOrder[], upcoming: [] as KitchenOrder[] };
    // Before the first tick, trust the buckets the server just computed.
    if (nowMs === null) return { queue: board.queue, upcoming: board.upcoming };
    // No prepare_at means an ASAP order, which is workable immediately.
    const isDue = (o: KitchenOrder) => !o.prepare_at || Date.parse(o.prepare_at) <= nowMs;

    // Mirrors the SQL ordering: priority first, then earliest prepare_at.
    const byPriorityThenPrepare = (a: KitchenOrder, b: KitchenOrder) => {
      const pa = a.is_priority ? 1 : 0;
      const pb = b.is_priority ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = a.prepare_at ? Date.parse(a.prepare_at) : Date.parse(a.created_at);
      const tb = b.prepare_at ? Date.parse(b.prepare_at) : Date.parse(b.created_at);
      return ta - tb;
    };

    return {
      queue: [...board.queue, ...board.upcoming.filter(isDue)].sort(byPriorityThenPrepare),
      upcoming: board.upcoming.filter((o) => !isDue(o)),
    };
  }, [board, nowMs]);

  const columnOrders: Record<string, KitchenOrder[]> = {
    PAID: queue,
    PREPARING: board?.preparing ?? [],
    READY: board?.ready ?? [],
  };

  const playNotification = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new Ctor();
      }
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      /* audio unavailable */
    }
  }, [soundEnabled]);

  useSocket('/kitchen', locationId ? { location_id: locationId } : undefined, {
    order_paid: () => {
      playNotification();
      refetchAll();
    },
    order_updated: refetchAll,
    order_ready: refetchAll,
    order_created: refetchAll,
    order_priority: () => {
      playNotification();
      refetchAll();
    },
    order_canceled: refetchAll,
  });

  // Live kitchen board: poll every 30s in addition to socket pushes.
  useEffect(() => {
    const interval = setInterval(refetchAll, 30000);
    return () => clearInterval(interval);
  }, [refetchAll]);

  const advanceStatus = useCallback(
    async (orderId: number, newStatus: string) => {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus }, token);
      setSelectedOrderId((prev) => (prev === orderId ? null : prev));
      refetchAll();
    },
    [token, refetchAll],
  );

  const toggleSelected = useCallback((orderId: number) => {
    setSelectedOrderId((prev) => (prev === orderId ? null : orderId));
  }, []);

  function openPriorityModal(order: KitchenOrder) {
    setModalReason('');
    setModalError(null);
    setPriorityModal({ order });
  }
  function openCancelModal(order: KitchenOrder) {
    setModalReason('');
    setModalError(null);
    setCancelModal({ order });
  }
  function closeActionModals() {
    setPriorityModal(null);
    setCancelModal(null);
    setModalReason('');
    setModalError(null);
    setModalSubmitting(false);
  }

  async function submitPriority() {
    if (!priorityModal) return;
    if (modalReason.trim().length < 3) return setModalError('Please write a short justification (at least 3 characters).');
    setModalSubmitting(true);
    setModalError(null);
    try {
      await api.post(`/orders/${priorityModal.order.id}/priority`, { reason: modalReason.trim() }, token);
      setToast({ message: `Order ${formatOrderNumber(priorityModal.order)} sent back to New Orders as priority.` });
      closeActionModals();
      refetchAll();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Failed to send order back to the queue.');
      setModalSubmitting(false);
    }
  }

  async function submitCancel() {
    if (!cancelModal) return;
    if (modalReason.trim().length < 3) return setModalError('Please write a short cancellation reason (at least 3 characters).');
    setModalSubmitting(true);
    setModalError(null);
    try {
      const result = await api.post<{ refund?: { amount?: number } }>(`/orders/${cancelModal.order.id}/cancel`, { reason: modalReason.trim() }, token);
      const refundMsg = result?.refund?.amount ? ` Refund issued for ${formatCurrency(result.refund.amount)}.` : '';
      setToast({ message: `Order ${formatOrderNumber(cancelModal.order)} canceled.${refundMsg}` });
      closeActionModals();
      refetchAll();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Failed to cancel order.');
      setModalSubmitting(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="-m-6 flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-primary-dark">
            <ChefHat size={26} className="text-primary" />
            Kitchen
          </h2>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-text-secondary" />
              <select
                value={selectedLocationId || ''}
                onChange={(e) => setSelectedLocationId(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-border bg-surface px-3 py-2 text-base font-semibold text-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {(locations || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {anyLoading && <Spinner size="sm" />}
        </div>

        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          aria-pressed={soundEnabled}
          className={`inline-flex min-h-[48px] min-w-[140px] items-center justify-center gap-2 rounded-full px-4 py-2 text-base font-bold transition-colors ${soundEnabled ? 'bg-primary-light text-primary-dark' : 'bg-gray-100 text-text-secondary'}`}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          {soundEnabled ? 'Sound On' : 'Sound Off'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden px-4 py-4">
        <div className="flex h-full gap-4 overflow-x-auto">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              column={col}
              orders={columnOrders[col.status]}
              loading={anyLoading}
              nowMs={nowMs}
              selectedOrderId={selectedOrderId}
              onSelect={toggleSelected}
              onAdvance={advanceStatus}
              onPrioritize={openPriorityModal}
              onCancel={openCancelModal}
            />
          ))}
        </div>
      </div>

      <KitchenScheduleStrip
        upcoming={upcoming}
        laterToday={board?.later_today ?? []}
        scheduledCount={board?.scheduled_count ?? 0}
        windowMinutes={board?.upcoming_window_minutes ?? 30}
      />

      <Modal open={!!priorityModal} onClose={modalSubmitting ? () => {} : closeActionModals} title={`Send order ${priorityModal?.order ? formatOrderNumber(priorityModal.order) : ''} back to queue`}>
        <div className="space-y-4">
          <p className="text-base leading-relaxed text-text-secondary">
            The order will move back to <strong>New Orders</strong> flagged as high priority and float to the top of the queue. Please note why — this is saved on the order.
          </p>
          <textarea
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            rows={4}
            placeholder="e.g. Customer noticed wrong flavor — needs to be remade."
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent/50"
            disabled={modalSubmitting}
          />
          {modalError && <p className="text-sm text-error">{modalError}</p>}
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={closeActionModals} disabled={modalSubmitting}>
              Cancel
            </Button>
            <Button variant="accent" size="lg" className="flex-1" onClick={submitPriority} disabled={modalSubmitting}>
              <RotateCcw size={18} />
              {modalSubmitting ? 'Sending...' : 'Send back to queue'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!cancelModal} onClose={modalSubmitting ? () => {} : closeActionModals} title={`Cancel order ${cancelModal?.order ? formatOrderNumber(cancelModal.order) : ''}`}>
        <div className="space-y-4">
          <p className="text-base leading-relaxed text-text-secondary">
            This will mark the order as canceled. If it was already paid, a full refund of <strong>{formatCurrency(cancelModal?.order?.total_amount || 0)}</strong> will be issued via Stripe. This cannot be undone.
          </p>
          <textarea
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            rows={4}
            placeholder="e.g. Customer no longer wants the order."
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent/50"
            disabled={modalSubmitting}
          />
          {modalError && <p className="text-sm text-error">{modalError}</p>}
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={closeActionModals} disabled={modalSubmitting}>
              Keep order
            </Button>
            <Button variant="danger" size="lg" className="flex-1" onClick={submitCancel} disabled={modalSubmitting}>
              <XCircle size={18} />
              {modalSubmitting ? 'Canceling...' : 'Cancel & refund'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-2xl border border-border/60 bg-surface px-5 py-4 shadow-[var(--shadow-elevated)]">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="mt-0.5 shrink-0 text-[#6B8E4E]" />
            <p className="text-base text-primary-dark">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
