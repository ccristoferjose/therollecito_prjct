import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, ChefHat, Bell, CheckCircle, Volume2, VolumeX, AlertTriangle,
  User, Timer, MapPin, CreditCard, RotateCcw, XCircle, Flame,
  MoreVertical, ArrowRight, Package, MessageSquare, Phone, Mail,
} from 'lucide-react';
import Modal from '@shared/components/Modal';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { useSocket } from '@shared/hooks/useSocket';
import { api } from '@shared/utils/api';
import { formatCurrency, formatOrderNumber, RESTAURANT_TZ } from '@shared/utils/format';
import Button from '@shared/components/Button';
import Spinner from '@shared/components/Spinner';

// =============================================================================
// KITCHEN — iPad-first
//
// Touch targets are ≥ 48px (Apple HIG minimum). Text sizes bumped so the
// kitchen can read orders from arm's length. Three columns are always visible
// on landscape iPad; each column scrolls independently so a busy column
// doesn't push the others off-screen.
// =============================================================================

const COLUMNS = [
  {
    status: 'PAID',
    label: 'New Orders',
    icon: Clock,
    nextStatus: 'PREPARING',
    nextAction: 'Start',
    nextIcon: ChefHat,
    headerBg: 'bg-[#F2D6B3]',
    headerText: 'text-primary-dark',
    accent: 'border-t-4 border-t-[#A86A4A]',
    dot: 'bg-[#A86A4A]',
  },
  {
    status: 'PREPARING',
    label: 'In Progress',
    icon: ChefHat,
    nextStatus: 'READY',
    nextAction: 'Mark Ready',
    nextIcon: Bell,
    headerBg: 'bg-[#F4A261]',
    headerText: 'text-primary-dark',
    accent: 'border-t-4 border-t-[#F4A261]',
    dot: 'bg-[#F4A261]',
  },
  {
    status: 'READY',
    label: 'Ready for Pickup',
    icon: Bell,
    nextStatus: 'COMPLETED',
    nextAction: 'Complete',
    nextIcon: CheckCircle,
    headerBg: 'bg-[#6B8E4E]',
    headerText: 'text-white',
    accent: 'border-t-4 border-t-[#6B8E4E]',
    dot: 'bg-[#6B8E4E]',
  },
];

function getWaitMinutes(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function WaitTimer({ createdAt }) {
  const [minutes, setMinutes] = useState(() => getWaitMinutes(createdAt));
  useEffect(() => {
    const interval = setInterval(() => setMinutes(getWaitMinutes(createdAt)), 15000);
    return () => clearInterval(interval);
  }, [createdAt]);
  const urgent = minutes >= 10;
  const warning = minutes >= 5 && minutes < 10;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-bold rounded-full px-2.5 py-1 ${
        urgent
          ? 'bg-red-100 text-red-700 animate-pulse'
          : warning
          ? 'bg-amber-100 text-amber-800'
          : 'bg-white/70 text-primary-dark'
      }`}
    >
      {urgent && <AlertTriangle size={14} />}
      <Timer size={14} />
      {minutes}m
    </span>
  );
}

function PaymentBadge({ status }) {
  if (!status) return null;
  const colors = {
    succeeded: 'bg-green-50 text-green-700 border-green-200',
    refunded: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 border ${
        colors[status] || 'bg-gray-50 text-text-secondary border-gray-200'
      }`}
    >
      <CreditCard size={12} />
      {status}
    </span>
  );
}

function PriorityBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase rounded-full px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 animate-pulse">
      <Flame size={12} />
      Priority
    </span>
  );
}

// -----------------------------------------------------------------------------
// KanbanCard — the actual order card in a column.
//
// Two render modes driven by `expanded`:
//   compact  → just the essentials (order #, wait timer, items, total, action),
//              so the kitchen can scan many orders at once.
//   expanded → full detail (customer, options/toppings, notes, secondary
//              actions). The parent ensures only ONE card across all columns
//              is expanded at a time.
// Tapping the card body toggles. Inner buttons stop propagation so they
// don't accidentally collapse/expand the card.
// -----------------------------------------------------------------------------
function KanbanCard({ order, column, expanded, onSelect, onAdvance, onPrioritize, onCancel }) {
  const [advancing, setAdvancing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Customer identity: guests carry guest_name/phone; registered customers
  // come through the joined user_* fields.
  const registeredName = [order.user_first_name, order.user_last_name].filter(Boolean).join(' ');
  const customerName = order.guest_name || registeredName || 'Registered customer';
  const customerPhone = order.guest_phone || order.user_phone || null;
  const customerEmail = order.user_email || null;
  // Order-level comment (checkout "special instructions") vs per-item notes.
  const orderComment = order.notes && order.notes.trim() ? order.notes.trim() : null;
  const toppingsCount = (order.items || []).reduce((n, it) => n + (it.options?.length || 0), 0);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [menuOpen]);

  async function handleAdvance(e) {
    e?.stopPropagation();
    setAdvancing(true);
    try {
      await onAdvance(order.id, column.nextStatus);
    } finally {
      setAdvancing(false);
    }
  }

  const stop = (e) => e.stopPropagation();

  return (
    <article
      onClick={() => onSelect(order.id)}
      className={`relative rounded-2xl bg-surface overflow-hidden cursor-pointer transition-all duration-150 ${column.accent} ${
        order.is_priority ? 'ring-2 ring-red-400' : ''
      } ${
        expanded
          ? 'shadow-[var(--shadow-elevated)] ring-2 ring-primary/40'
          : 'shadow-[var(--shadow-card)] hover:shadow-md'
      }`}
    >
      {/* Card header: order number + wait + actions menu (always visible) */}
      <div className={`flex items-start justify-between px-4 ${expanded ? 'pt-4 pb-2' : 'py-2.5'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-extrabold text-primary-dark ${expanded ? 'text-2xl' : 'text-xl'}`}>
            {formatOrderNumber(order)}
          </span>
          <WaitTimer createdAt={order.created_at} />
          {!expanded && (
            <span className="text-xs font-semibold text-text-secondary">
              · {(order.items?.length || 0)} item{(order.items?.length || 0) !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Overflow menu — only when expanded (keeps compact card uncluttered) */}
        {expanded && (
          <div className="relative" ref={menuRef} onClick={stop}>
            <button
              type="button"
              onClick={(e) => { stop(e); setMenuOpen((v) => !v); }}
              aria-label="More actions"
              className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-full text-primary-dark/70 hover:bg-primary-light/50 active:bg-primary-light/80 transition-colors"
            >
              <MoreVertical size={22} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-20 min-w-[210px] rounded-2xl bg-surface shadow-[var(--shadow-elevated)] border border-border/60 overflow-hidden">
                {column.status !== 'PAID' && (
                  <button
                    type="button"
                    onClick={(e) => { stop(e); setMenuOpen(false); onPrioritize(order); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-base font-semibold text-amber-800 hover:bg-amber-50 active:bg-amber-100"
                  >
                    <RotateCcw size={18} />
                    Send back to queue
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { stop(e); setMenuOpen(false); onCancel(order); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-base font-semibold text-red-700 hover:bg-red-50 active:bg-red-100 border-t border-border/60"
                >
                  <XCircle size={18} />
                  Cancel &amp; refund
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === EXPANDED-ONLY SECTIONS === */}
      {expanded && (
        <>
          {/* Badges row */}
          {(order.is_priority || order.payment_status) && (
            <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
              {order.is_priority ? <PriorityBadge /> : null}
              <PaymentBadge status={order.payment_status} />
            </div>
          )}

          {/* Customer block — name, phone, email, pickup */}
          <div className="px-4 py-2.5 border-t border-border/60 text-sm">
            <div className="flex items-center gap-2">
              <User size={16} className="text-text-secondary shrink-0" />
              <span className="font-semibold text-primary-dark truncate">{customerName}</span>
              {!order.guest_name && registeredName && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary-light/60 rounded px-1.5 py-0.5">
                  Account
                </span>
              )}
              {order.pickup_time && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary-dark bg-[#FFF1DC] rounded-full px-2 py-0.5 shrink-0">
                  <Clock size={12} />
                  {new Date(order.pickup_time).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: RESTAURANT_TZ,
                  })}
                </span>
              )}
            </div>
            {(customerPhone || customerEmail) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-xs text-text-secondary">
                {customerPhone && (
                  <a href={`tel:${customerPhone}`} className="inline-flex items-center gap-1 hover:text-primary">
                    <Phone size={12} /> {customerPhone}
                  </a>
                )}
                {customerEmail && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail size={12} /> {customerEmail}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Order comment — the customer's special instructions. High-contrast
              callout so the kitchen never misses it. */}
          {orderComment && (
            <div className="mx-4 mb-1 mt-1 rounded-xl border-2 border-accent/40 bg-accent/10 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare size={14} className="text-accent-hover" />
                <p className="text-[11px] font-bold uppercase tracking-wide text-accent-hover">
                  Customer note
                </p>
              </div>
              <p className="text-sm font-semibold text-primary-dark whitespace-pre-wrap break-words">
                {orderComment}
              </p>
            </div>
          )}

          {/* Items list */}
          <div className="px-4 py-3 border-t border-border/60 space-y-2.5 bg-[#FFF1DC]/40">
            {(order.items || []).map((item) => (
              <div key={item.id} className="flex items-start gap-2.5">
                <span className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-primary text-text-inverse text-sm font-extrabold">
                  {item.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-primary-dark leading-tight">
                    {item.item_name}
                  </p>
                  {item.options?.length > 0 && (
                    <div className="mt-1.5 rounded-lg bg-amber-50 border border-amber-300 px-2.5 py-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 mb-1">
                        + Toppings ({item.options.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.options.map((opt) => (
                          <span
                            key={opt.id}
                            className="inline-flex items-center gap-1 text-sm font-bold text-amber-900 bg-white border border-amber-300 rounded-md px-2 py-0.5"
                          >
                            {opt.option_value_name}
                            {opt.price_modifier > 0 && (
                              <span className="text-[11px] font-semibold text-amber-700">
                                +{formatCurrency(opt.price_modifier)}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.notes && (
                    <p className="mt-1 flex items-start gap-1 text-sm font-semibold text-accent-hover">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {item.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Priority reason (send-back note) */}
          {order.is_priority && order.priority_reason && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-800">
                <strong>Sent back:</strong> {order.priority_reason}
              </p>
            </div>
          )}
        </>
      )}

      {/* === COMPACT-ONLY ROW === customer + total + a hint that it's tappable */}
      {!expanded && (
        <div className="px-4 pb-2.5 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-primary-dark truncate flex items-center gap-1.5 min-w-0">
            <User size={14} className="text-text-secondary shrink-0" />
            <span className="truncate">{customerName}</span>
            {order.is_priority && <Flame size={14} className="text-red-600 shrink-0" />}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick indicators — tap the card to see the detail. */}
            {orderComment && (
              <span className="inline-flex items-center gap-0.5 text-accent-hover" title="Customer note">
                <MessageSquare size={14} />
              </span>
            )}
            {toppingsCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-amber-700 font-semibold"
                title={`${toppingsCount} topping${toppingsCount !== 1 ? 's' : ''}`}
              >
                <Package size={14} />{toppingsCount}
              </span>
            )}
            <span className="text-base font-extrabold text-primary">
              {formatCurrency(order.total_amount)}
            </span>
          </div>
        </div>
      )}

      {/* Footer: total (expanded only) + big primary action — always visible */}
      <div className={`px-4 ${expanded ? 'pt-3 pb-4 border-t border-border/60' : 'pb-3'}`}>
        {expanded && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-secondary">
              <Package size={14} className="inline -mt-0.5 mr-1" />
              {(order.items?.length || 0)} item
              {(order.items?.length || 0) !== 1 ? 's' : ''}
            </span>
            <span className="text-lg font-extrabold text-primary">
              {formatCurrency(order.total_amount)}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleAdvance}
          disabled={advancing}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-text-inverse font-bold shadow-[var(--shadow-warm)] transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
            expanded ? 'min-h-[56px] text-lg' : 'min-h-[44px] text-base'
          }`}
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

// -----------------------------------------------------------------------------
// KanbanColumn — one of three vertical lanes.
// -----------------------------------------------------------------------------
function KanbanColumn({ column, orders, loading, selectedOrderId, onSelect, onAdvance, onPrioritize, onCancel }) {
  const Icon = column.icon;
  return (
    <section className="flex-1 min-w-[300px] flex flex-col rounded-2xl bg-[#FFF1DC]/80 overflow-hidden">
      {/* Sticky header */}
      <header
        className={`flex items-center justify-between px-4 py-3 ${column.headerBg} ${column.headerText} shadow-sm`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/30`}
          >
            <Icon size={18} />
          </span>
          <h3 className="text-base font-bold uppercase tracking-wide">{column.label}</h3>
        </div>
        <span className="inline-flex items-center justify-center h-8 min-w-8 px-2.5 rounded-full bg-white/90 text-primary-dark text-sm font-extrabold">
          {orders.length}
        </span>
      </header>

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth">
        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full ${column.dot} opacity-20 mb-3`}
            />
            <p className="text-base font-semibold text-primary-dark/70">
              No orders here
            </p>
            <p className="text-sm text-primary-dark/50 mt-1">
              New orders will appear automatically.
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <KanbanCard
              key={order.id}
              order={order}
              column={column}
              expanded={order.id === selectedOrderId}
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

// =============================================================================
// KitchenDashboard (page)
// =============================================================================
export default function KitchenDashboard() {
  const { token, user } = useStaffAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState(user?.location_id || null);
  // Globally only ONE card is expanded at a time, across all three columns.
  // null = all collapsed. Tapping a card toggles; selecting a different card
  // implicitly collapses the previous one.
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [priorityModal, setPriorityModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [modalReason, setModalReason] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [toast, setToast] = useState(null);
  // Prominent "new order" banner, shown alongside the sound when a PAID order
  // lands so the kitchen can't miss it even glancing away.
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const newOrderTimer = useRef(null);
  const audioRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const locationId = isAdmin ? selectedLocationId : user?.location_id;
  const { data: locations } = useFetch(isAdmin ? '/locations' : null, token);

  useEffect(() => {
    if (isAdmin && !selectedLocationId && locations?.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [isAdmin, selectedLocationId, locations]);

  // Three parallel fetches — one per kanban column.
  const paidFetch = useFetch(
    locationId ? `/kitchen/orders?location_id=${locationId}&status=PAID` : null,
    token
  );
  const prepFetch = useFetch(
    locationId ? `/kitchen/orders?location_id=${locationId}&status=PREPARING` : null,
    token
  );
  const readyFetch = useFetch(
    locationId ? `/kitchen/orders?location_id=${locationId}&status=READY` : null,
    token
  );

  const columnOrders = {
    PAID: Array.isArray(paidFetch.data) ? paidFetch.data : [],
    PREPARING: Array.isArray(prepFetch.data) ? prepFetch.data : [],
    READY: Array.isArray(readyFetch.data) ? readyFetch.data : [],
  };

  const anyLoading = paidFetch.loading || prepFetch.loading || readyFetch.loading;

  const refetchAll = useCallback(() => {
    paidFetch.refetch();
    prepFetch.refetch();
    readyFetch.refetch();
  }, [paidFetch, prepFetch, readyFetch]);

  // Raw alert emitter — NOT gated by soundEnabled so it can double as a
  // "test sound" that also unlocks the AudioContext on a user gesture.
  const emitAlertSound = useCallback(() => {
    try {
      if (!audioRef.current)
        audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      // Browsers suspend the context until a user gesture; resume so the alert
      // still fires when the tab has been idle.
      if (ctx.state === 'suspended') ctx.resume();

      // Attention-grabbing alert: a bright ascending 3-note chime, repeated a
      // few times and louder than a single beep so it carries over kitchen
      // noise. Each note is a short triangle-wave ping with a fast attack/decay.
      const notes = [784, 1047, 1319]; // G5 · C6 · E6 — rising major triad
      const noteDur = 0.15;
      const gap = 0.04;
      const seqSpan = notes.length * (noteDur + gap);
      const repeats = 3;
      for (let r = 0; r < repeats; r++) {
        const base = ctx.currentTime + r * (seqSpan + 0.16);
        notes.forEach((freq, i) => {
          const t = base + i * (noteDur + gap);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);
          osc.start(t);
          osc.stop(t + noteDur + 0.05);
        });
      }
    } catch {
      /* Audio not available */
    }
  }, []);

  const playNotification = useCallback(() => {
    if (soundEnabled) emitAlertSound();
  }, [soundEnabled, emitAlertSound]);

  // Toggling sound ON plays a preview — confirms it's audible AND unlocks the
  // AudioContext (a gesture) so later socket-triggered alerts actually sound.
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) emitAlertSound();
      return next;
    });
  }, [emitAlertSound]);

  // Flash the prominent "new order" banner for a few seconds. Independent of
  // the sound toggle so it's visible even with sound muted.
  const flashNewOrder = useCallback(() => {
    setNewOrderAlert(true);
    if (newOrderTimer.current) clearTimeout(newOrderTimer.current);
    newOrderTimer.current = setTimeout(() => setNewOrderAlert(false), 6000);
  }, []);

  useEffect(() => () => {
    if (newOrderTimer.current) clearTimeout(newOrderTimer.current);
  }, []);

  useSocket('/kitchen', locationId ? { location_id: locationId } : null, {
    order_paid: () => {
      playNotification();
      flashNewOrder();
      refetchAll();
    },
    order_updated: refetchAll,
    order_ready: refetchAll,
    order_created: refetchAll,
    order_priority: () => {
      playNotification();
      flashNewOrder();
      refetchAll();
    },
    order_canceled: refetchAll,
  });

  useEffect(() => {
    const interval = setInterval(refetchAll, 30000);
    return () => clearInterval(interval);
  }, [refetchAll]);

  const advanceStatus = useCallback(
    async (orderId, newStatus) => {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus }, token);
      // Card disappears from this column once advanced; collapse so the next
      // card doesn't auto-expand into the freed slot.
      setSelectedOrderId((prev) => (prev === orderId ? null : prev));
      refetchAll();
    },
    [token, refetchAll]
  );

  const toggleSelected = useCallback((orderId) => {
    setSelectedOrderId((prev) => (prev === orderId ? null : orderId));
  }, []);

  function openPriorityModal(order) {
    setModalReason('');
    setModalError(null);
    setPriorityModal({ order });
  }
  function openCancelModal(order) {
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
    if (modalReason.trim().length < 3) {
      setModalError('Please write a short justification (at least 3 characters).');
      return;
    }
    setModalSubmitting(true);
    setModalError(null);
    try {
      await api.post(
        `/orders/${priorityModal.order.id}/priority`,
        { reason: modalReason.trim() },
        token
      );
      setToast({
        kind: 'success',
        message: `Order ${formatOrderNumber(
          priorityModal.order
        )} sent back to New Orders as priority.`,
      });
      closeActionModals();
      refetchAll();
    } catch (err) {
      setModalError(err?.message || 'Failed to send order back to the queue.');
      setModalSubmitting(false);
    }
  }

  async function submitCancel() {
    if (modalReason.trim().length < 3) {
      setModalError('Please write a short cancellation reason (at least 3 characters).');
      return;
    }
    setModalSubmitting(true);
    setModalError(null);
    try {
      const result = await api.post(
        `/orders/${cancelModal.order.id}/cancel`,
        { reason: modalReason.trim() },
        token
      );
      const refundMsg = result?.refund?.amount
        ? ` Refund issued for ${formatCurrency(result.refund.amount)}.`
        : '';
      setToast({
        kind: 'success',
        message: `Order ${formatOrderNumber(cancelModal.order)} canceled.${refundMsg}`,
      });
      closeActionModals();
      refetchAll();
    } catch (err) {
      setModalError(err?.message || 'Failed to cancel order.');
      setModalSubmitting(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Prominent "new order" banner — top-center, bounces + pulses so it's
          impossible to miss. Auto-dismisses after a few seconds; tap to clear. */}
      {newOrderAlert && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={() => setNewOrderAlert(false)}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-primary px-6 py-3.5 text-text-inverse shadow-[var(--shadow-elevated)] ring-4 ring-primary/30 animate-bounce"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
            <Bell size={24} />
            <span className="text-lg font-extrabold uppercase tracking-wide">New order received</span>
            <XCircle size={20} className="opacity-70" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-border/60 bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-2xl font-extrabold text-primary-dark flex items-center gap-2">
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
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          className={`min-h-[48px] min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-base font-bold transition-colors ${
            soundEnabled
              ? 'bg-primary-light text-primary-dark'
              : 'bg-gray-100 text-text-secondary'
          }`}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          {soundEnabled ? 'Sound On' : 'Sound Off'}
        </button>
      </div>

      {/* Three kanban columns */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        <div className="h-full flex gap-4 overflow-x-auto">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              column={col}
              orders={columnOrders[col.status]}
              loading={anyLoading}
              selectedOrderId={selectedOrderId}
              onSelect={toggleSelected}
              onAdvance={advanceStatus}
              onPrioritize={openPriorityModal}
              onCancel={openCancelModal}
            />
          ))}
        </div>
      </div>

      {/* Send-back-to-queue modal */}
      <Modal
        open={!!priorityModal}
        onClose={modalSubmitting ? () => {} : closeActionModals}
        title={`Send order ${
          priorityModal?.order ? formatOrderNumber(priorityModal.order) : ''
        } back to queue`}
      >
        <div className="space-y-4">
          <p className="text-base text-text-secondary leading-relaxed">
            The order will move back to <strong>New Orders</strong> flagged as high
            priority and float to the top of the queue. Please note why — this is saved
            on the order.
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
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={closeActionModals}
              disabled={modalSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              size="lg"
              className="flex-1"
              onClick={submitPriority}
              disabled={modalSubmitting}
            >
              <RotateCcw size={18} />
              {modalSubmitting ? 'Sending...' : 'Send back to queue'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel-and-refund modal */}
      <Modal
        open={!!cancelModal}
        onClose={modalSubmitting ? () => {} : closeActionModals}
        title={`Cancel order ${
          cancelModal?.order ? formatOrderNumber(cancelModal.order) : ''
        }`}
      >
        <div className="space-y-4">
          <p className="text-base text-text-secondary leading-relaxed">
            This will mark the order as canceled. If it was already paid, a full refund
            of{' '}
            <strong>{formatCurrency(cancelModal?.order?.total_amount || 0)}</strong>{' '}
            will be issued via Stripe. This cannot be undone.
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
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={closeActionModals}
              disabled={modalSubmitting}
            >
              Keep order
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={submitCancel}
              disabled={modalSubmitting}
            >
              <XCircle size={18} />
              {modalSubmitting ? 'Canceling...' : 'Cancel & refund'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-surface shadow-[var(--shadow-elevated)] border border-border/60 px-5 py-4 max-w-md">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="text-[#6B8E4E] shrink-0 mt-0.5" />
            <p className="text-base text-primary-dark">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
