'use client';

import { useState } from 'react';
import { Plus, MapPin, Pencil, ToggleLeft, ToggleRight, Clock } from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { api, ApiError } from '@/lib/api/client';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Modal from '@/components/ui/modal';
import Spinner from '@/components/ui/spinner';
import type { Location } from '@/lib/types';

const emptyForm = { name: '', address: '', city: '', state: '', zipCode: '', phone: '', openTime: '', closeTime: '' };

export default function LocationManagement() {
  const { token } = useStaffAuth();
  const { data: locations, loading, refetch } = useFetch<Location[]>('/locations/all', token);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const trimSeconds = (t?: string | null) => (t ? String(t).slice(0, 5) : '');

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zipCode: loc.zip_code,
      phone: loc.phone || '',
      openTime: trimSeconds(loc.open_time),
      closeTime: trimSeconds(loc.close_time),
    });
    setSaveError(null);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const hasOpen = !!form.openTime;
    const hasClose = !!form.closeTime;
    if (hasOpen !== hasClose) {
      setSaveError('Set both opening and closing times, or leave both empty.');
      return;
    }
    if (hasOpen && hasClose && form.closeTime <= form.openTime) {
      setSaveError('Closing time must be after opening time.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        openTime: form.openTime || null,
        closeTime: form.closeTime || null,
        clearHours: Boolean(editing) && !hasOpen && !hasClose,
      };
      if (editing) await api.put(`/locations/${editing.id}`, payload, token);
      else await api.post('/locations', payload, token);
      setShowModal(false);
      refetch();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(loc: Location) {
    await api.patch(`/locations/${loc.id}/active`, { is_active: !loc.is_active }, token);
    refetch();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">Locations</h2>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={14} /> Add Location
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(locations || []).map((loc) => (
          <Card key={loc.id} className={`flex flex-col gap-2 ${!loc.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                <MapPin size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text">{loc.name}</h3>
                <p className="text-sm text-text-secondary">
                  {loc.address}, {loc.city}, {loc.state} {loc.zip_code}
                </p>
              </div>
            </div>
            {loc.phone && <p className="text-sm text-text-secondary">Phone: {loc.phone}</p>}
            {loc.open_time && loc.close_time ? (
              <p className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Clock size={12} className="text-primary" />
                Hours: {trimSeconds(loc.open_time)} – {trimSeconds(loc.close_time)}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs italic text-text-secondary/70">
                <Clock size={12} /> No hours set (always open)
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(loc)}>
                <Pencil size={12} /> Edit
              </Button>
              <button
                onClick={() => handleToggleActive(loc)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  loc.is_active
                    ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    : 'border-gray-200 bg-gray-50 text-text-secondary hover:bg-gray-100'
                }`}
              >
                {loc.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                {loc.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Location' : 'Add Location'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Name" name="name" value={form.name} onChange={handleChange} required />
          <Input label="Address" name="address" value={form.address} onChange={handleChange} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="City" name="city" value={form.city} onChange={handleChange} required />
            <Input label="State" name="state" value={form.state} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Zip Code" name="zipCode" value={form.zipCode} onChange={handleChange} required />
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-primary-light/20 p-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              <p className="text-sm font-medium text-text">Service hours (optional)</p>
            </div>
            <p className="text-xs text-text-secondary">
              When set, customers ordering before opening time can schedule a pickup for later today. Leave both fields
              empty to disable scheduling.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Open" name="openTime" type="time" value={form.openTime} onChange={handleChange} />
              <Input label="Close" name="closeTime" type="time" value={form.closeTime} onChange={handleChange} />
            </div>
          </div>

          {saveError && <p className="text-sm text-error">{saveError}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update Location' : 'Create Location'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
