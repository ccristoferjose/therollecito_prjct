'use client';

import { useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Calendar, ImageOff, Eye, EyeOff, Tag } from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import type { Promotion } from '@/lib/types';
import type { PromoCampaign, PromoFrequency } from '@/features/promo-campaign/types';
import { WEEKDAYS, FREQUENCY_OPTIONS } from '@/features/promo-campaign/types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  name: string;
  promotionId: string;
  imageAlt: string;
  buttonText: string;
  buttonUrl: string;
  frequency: PromoFrequency;
  startsOn: string;
  endsOn: string;
  priority: string;
  isActive: boolean;
  days: number[];
  desktopPreview: string;
  mobilePreview: string;
  desktopBase64: string | null;
  mobileBase64: string | null;
}

const emptyForm: FormState = {
  name: '', promotionId: '', imageAlt: '', buttonText: 'Order Now', buttonUrl: '/order',
  frequency: 'once_per_day', startsOn: today(), endsOn: '', priority: '0', isActive: true,
  days: [], desktopPreview: '', mobilePreview: '', desktopBase64: null, mobileBase64: null,
};

const inputClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base text-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/50';
const labelClass = 'mb-1.5 block text-sm font-bold text-primary-dark';

/**
 * Promotional campaigns — the artwork shown in the homepage modal.
 *
 * The restaurant's designer owns the message (it is baked into the image); this
 * screen owns the behaviour: when it runs, how often one visitor sees it, and
 * where the button goes.
 */
export default function CampaignManagement() {
  const { token } = useStaffAuth();
  const { data: campaigns, loading, refetch } = useFetch<PromoCampaign[]>('/promo-campaigns', token);
  const { data: promotions } = useFetch<Promotion[]>('/promotions', token);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromoCampaign | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PromoCampaign | null>(null);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setError(null);
    setShowModal(true);
  }

  function openEdit(c: PromoCampaign) {
    setEditing(c);
    setForm({
      name: c.name,
      promotionId: c.promotion_id ? String(c.promotion_id) : '',
      imageAlt: c.image_alt || '',
      buttonText: c.button_text || '',
      buttonUrl: c.button_url || '',
      frequency: c.frequency,
      startsOn: c.starts_on?.slice(0, 10) || today(),
      endsOn: c.ends_on ? c.ends_on.slice(0, 10) : '',
      priority: String(c.priority ?? 0),
      isActive: Boolean(c.is_active),
      days: c.days || [],
      desktopPreview: c.image_desktop_url || '',
      mobilePreview: c.image_mobile_url || '',
      desktopBase64: null,
      mobileBase64: null,
    });
    setError(null);
    setShowModal(true);
  }

  function pickImage(variant: 'desktop' | 'mobile', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!ACCEPTED.includes(file.type)) return setError('Use JPEG, PNG, or WebP.');
    if (file.size > MAX_IMAGE_BYTES) return setError('Image must be under 5MB.');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm((p) => variant === 'desktop'
        ? { ...p, desktopBase64: result, desktopPreview: result }
        : { ...p, mobileBase64: result, mobilePreview: result });
    };
    reader.onerror = () => setError('Failed to read image file.');
    reader.readAsDataURL(file);
  }

  function toggleDay(day: number) {
    setForm((p) => ({
      ...p,
      days: p.days.includes(day) ? p.days.filter((d) => d !== day) : [...p.days, day].sort((a, b) => a - b),
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const hasArtwork = form.desktopBase64 || form.mobileBase64 || form.desktopPreview || form.mobilePreview;
    if (!hasArtwork) return setError('Upload at least one image — the artwork is the modal.');
    if (!form.imageAlt.trim()) {
      return setError('Describe the image. The artwork carries the whole message, so a screen reader needs it in words.');
    }
    if (form.buttonText.trim() && !form.buttonUrl.trim()) {
      return setError('A button needs a destination.');
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        promotion_id: form.promotionId ? Number(form.promotionId) : null,
        image_alt: form.imageAlt.trim(),
        button_text: form.buttonText.trim() || null,
        button_url: form.buttonUrl.trim() || null,
        frequency: form.frequency,
        starts_on: form.startsOn,
        ends_on: form.endsOn || null,
        priority: Number(form.priority) || 0,
        is_active: form.isActive,
        days: form.days,
      };

      const saved: PromoCampaign = editing
        ? await api.put(`/promo-campaigns/${editing.id}`, payload, token)
        : await api.post('/promo-campaigns', payload, token);

      // Artwork is uploaded after the row exists, so the S3 key can be filed
      // under the campaign id.
      for (const variant of ['desktop', 'mobile'] as const) {
        const base64 = variant === 'desktop' ? form.desktopBase64 : form.mobileBase64;
        if (!base64) continue;
        await api.post(`/uploads/promo-campaigns/${saved.id}/image`, { variant, image_base64: base64 }, token);
      }

      setShowModal(false);
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the campaign.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: PromoCampaign) {
    // Sends only is_active — the backend leaves the weekday schedule untouched.
    await api.put(`/promo-campaigns/${c.id}`, { is_active: !c.is_active }, token);
    refetch();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await api.delete(`/promo-campaigns/${confirmDelete.id}`, token);
    setConfirmDelete(null);
    refetch();
  }

  const scheduleLabel = (c: PromoCampaign) =>
    c.runs_every_day
      ? 'Every day'
      : c.days.map((d) => WEEKDAYS.find((w) => w.value === d)?.short).filter(Boolean).join(', ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-primary-dark">
            <Megaphone size={26} className="text-primary" />
            Promotional campaigns
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            The popup shown on the homepage. The image is the message — upload the artwork and set when it runs.
          </p>
        </div>
        <Button variant="accent" size="lg" onClick={openCreate}>
          <Plus size={18} />
          New campaign
        </Button>
      </div>

      {loading && !campaigns ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !campaigns?.length ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create one to show a promotional popup on the homepage."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <Card key={c.id} padding={false} className="flex flex-col overflow-hidden">
              <div className="relative aspect-[4/3] w-full bg-[#FFF1DC]">
                {c.image_desktop_url || c.image_mobile_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(c.image_desktop_url || c.image_mobile_url) as string}
                    alt={c.image_alt || c.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-text-secondary">
                    <ImageOff size={28} />
                    <span className="text-xs font-semibold">No artwork — will not show</span>
                  </div>
                )}
                <span className="absolute left-3 top-3">
                  <Badge className={c.is_active ? 'bg-green-50 text-green-700' : undefined}>
                    {c.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-base font-bold text-primary-dark">{c.name}</h3>

                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={13} />
                    {scheduleLabel(c)}
                  </span>
                  {c.promo_code && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 font-bold text-primary-dark">
                      <Tag size={12} />
                      {c.promo_code}
                    </span>
                  )}
                </div>

                <p className="text-xs text-text-secondary">
                  {formatDate(c.starts_on)} → {c.ends_on ? formatDate(c.ends_on) : 'no end date'}
                  {' · '}
                  {FREQUENCY_OPTIONS.find((f) => f.value === c.frequency)?.label}
                  {c.priority > 0 && ` · priority ${c.priority}`}
                </p>

                <div className="mt-auto flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(c)}>
                    <Pencil size={15} /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(c)} aria-label={c.is_active ? 'Pause' : 'Activate'}>
                    {c.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(c)} aria-label="Delete">
                    <Trash2 size={15} className="text-error" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create / edit                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={showModal}
        onClose={saving ? () => {} : () => setShowModal(false)}
        title={editing ? `Edit ${editing.name}` : 'Create campaign'}
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className={labelClass} htmlFor="pc-name">Campaign name</label>
            <input
              id="pc-name" className={inputClass} required maxLength={150}
              placeholder="Friday 15% Off"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <p className="mt-1 text-xs text-text-secondary">Internal label — customers never see this.</p>
          </div>

          {/* Artwork -------------------------------------------------------- */}
          <fieldset className="rounded-2xl border border-border/60 p-4">
            <legend className="px-2 text-sm font-bold text-primary-dark">Promotional artwork</legend>
            <p className="mb-3 text-xs text-text-secondary">
              The image carries the whole offer. Upload both shapes so a phone gets the vertical
              version and desktop the wide one — either alone is used for both if the other is missing.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {(['desktop', 'mobile'] as const).map((variant) => {
                const preview = variant === 'desktop' ? form.desktopPreview : form.mobilePreview;
                return (
                  <div key={variant}>
                    <label className={labelClass} htmlFor={`pc-img-${variant}`}>
                      {variant === 'desktop' ? 'Desktop · 1200×800' : 'Mobile · 1080×1350'}
                    </label>
                    <div className={`mb-2 flex items-center justify-center overflow-hidden rounded-xl bg-[#FFF1DC] ${variant === 'desktop' ? 'aspect-[3/2]' : 'aspect-[4/5]'}`}>
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff size={24} className="text-text-secondary" />
                      )}
                    </div>
                    <input
                      id={`pc-img-${variant}`} type="file" accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => pickImage(variant, e)}
                      className="w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-primary-dark"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <label className={labelClass} htmlFor="pc-alt">Image description</label>
              <input
                id="pc-alt" className={inputClass} maxLength={255} required
                placeholder="Friday special — 15% off with code FRIDAY15"
                value={form.imageAlt}
                onChange={(e) => setForm((p) => ({ ...p, imageAlt: e.target.value }))}
              />
              <p className="mt-1 text-xs text-text-secondary">
                Read aloud to customers using a screen reader — without it the promo is silent for them.
              </p>
            </div>
          </fieldset>

          {/* Offer ---------------------------------------------------------- */}
          <div>
            <label className={labelClass} htmlFor="pc-promo">Promo code (optional)</label>
            <select
              id="pc-promo" className={inputClass}
              value={form.promotionId}
              onChange={(e) => setForm((p) => ({ ...p, promotionId: e.target.value }))}
            >
              <option value="">No code — announcement only</option>
              {(promotions || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} ({p.discount_type === 'percentage' ? `${p.discount_value}%` : `$${p.discount_value}`} off)
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              Shown under the image. Hidden automatically if the code expires.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pc-btn-text">Button text</label>
              <input
                id="pc-btn-text" className={inputClass} maxLength={80} placeholder="Order Now"
                value={form.buttonText}
                onChange={(e) => setForm((p) => ({ ...p, buttonText: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pc-btn-url">Button destination</label>
              <input
                id="pc-btn-url" className={inputClass} maxLength={255} placeholder="/order"
                value={form.buttonUrl}
                onChange={(e) => setForm((p) => ({ ...p, buttonUrl: e.target.value }))}
              />
              <p className="mt-1 text-xs text-text-secondary">Internal path only, starting with &ldquo;/&rdquo;.</p>
            </div>
          </div>

          {/* Schedule ------------------------------------------------------- */}
          <fieldset className="rounded-2xl border border-border/60 p-4">
            <legend className="px-2 text-sm font-bold text-primary-dark">Schedule</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pc-start">Start date</label>
                <input
                  id="pc-start" type="date" className={inputClass} required
                  value={form.startsOn}
                  onChange={(e) => setForm((p) => ({ ...p, startsOn: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pc-end">End date</label>
                <input
                  id="pc-end" type="date" className={inputClass} min={form.startsOn}
                  value={form.endsOn}
                  onChange={(e) => setForm((p) => ({ ...p, endsOn: e.target.value }))}
                />
                <p className="mt-1 text-xs text-text-secondary">Leave empty to run indefinitely.</p>
              </div>
            </div>

            <div className="mt-4">
              <span className={labelClass}>Days</span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = form.days.includes(d.value);
                  return (
                    <button
                      key={d.value} type="button" onClick={() => toggleDay(d.value)}
                      aria-pressed={on}
                      className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold transition-colors ${on ? 'bg-primary text-text-inverse' : 'bg-gray-100 text-text-secondary hover:bg-primary-light'}`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-text-secondary">
                {form.days.length === 0
                  ? 'None selected — the campaign runs every day.'
                  : `Runs only on ${form.days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(', ')}.`}
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pc-freq">Show frequency</label>
                <select
                  id="pc-freq" className={inputClass} value={form.frequency}
                  onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as PromoFrequency }))}
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-text-secondary">
                  {FREQUENCY_OPTIONS.find((f) => f.value === form.frequency)?.hint}
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="pc-priority">Priority</label>
                <input
                  id="pc-priority" type="number" min={0} className={inputClass}
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                />
                <p className="mt-1 text-xs text-text-secondary">
                  Highest wins when several campaigns run the same day.
                </p>
              </div>
            </div>
          </fieldset>

          <label className="flex items-center gap-3 text-base font-semibold text-primary-dark">
            <input
              type="checkbox" checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-5 w-5 rounded border-border accent-[var(--color-primary)]"
            />
            Display as popup
          </label>

          {error && <p className="text-sm font-semibold text-error">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" size="lg" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save campaign'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete campaign">
        <div className="space-y-4">
          <p className="text-base text-text-secondary">
            Delete <strong>{confirmDelete?.name}</strong>? The artwork stops showing immediately.
            Any linked promo code is untouched.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmDelete(null)}>
              Keep
            </Button>
            <Button variant="danger" size="lg" className="flex-1" onClick={handleDelete}>
              <Trash2 size={18} /> Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
