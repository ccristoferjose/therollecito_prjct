import { useState } from 'react';
import { Plus, Tag, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency, formatDate } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Input from '@shared/components/Input';
import Modal from '@shared/components/Modal';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

const emptyForm = {
  code: '', description: '', discountType: 'percentage', discountValue: '',
  minOrder: '', maxUses: '', startsAt: '', expiresAt: '',
};

export default function PromotionManagement() {
  const { token } = useStaffAuth();
  const { data: promotions, loading, refetch } = useFetch('/promotions', token);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(promo) {
    setEditing(promo);
    setForm({
      code: promo.code,
      description: promo.description || '',
      discountType: promo.discount_type,
      discountValue: String(promo.discount_value),
      minOrder: promo.min_order ? String(promo.min_order) : '',
      maxUses: promo.max_uses ? String(promo.max_uses) : '',
      startsAt: promo.starts_at ? new Date(promo.starts_at).toISOString().slice(0, 16) : '',
      expiresAt: promo.expires_at ? new Date(promo.expires_at).toISOString().slice(0, 16) : '',
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        description: form.description || null,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        minOrder: form.minOrder ? parseFloat(form.minOrder) : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        startsAt: form.startsAt,
        expiresAt: form.expiresAt || null,
      };
      if (editing) {
        await api.put(`/promotions/${editing.id}`, payload, token);
      } else {
        await api.post('/promotions', payload, token);
      }
      setShowModal(false);
      refetch();
    } catch { /* handled */ } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!showDeleteConfirm) return;
    setSaving(true);
    try {
      await api.delete(`/promotions/${showDeleteConfirm.id}`, token);
      setShowDeleteConfirm(null);
      refetch();
    } catch { /* handled */ } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(promo) {
    await api.put(`/promotions/${promo.id}`, { isActive: !promo.is_active }, token);
    refetch();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  const promoList = Array.isArray(promotions) ? promotions : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text">Promotions</h2>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={14} /> Create Promotion
        </Button>
      </div>

      {promoList.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No promotions yet"
          description="Create discount codes for your customers."
          action={<Button variant="outline" onClick={openCreate}>Create First Promotion</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promoList.map((promo) => (
            <Card key={promo.id} className={!promo.is_active ? 'opacity-50' : ''}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary-dark text-lg">{promo.code}</span>
                    {promo.is_active ? (
                      <Badge status="READY">Active</Badge>
                    ) : (
                      <Badge status="COMPLETED">Inactive</Badge>
                    )}
                  </div>
                  {promo.description && (
                    <p className="text-sm text-text-secondary mt-1">{promo.description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Discount</span>
                  <span className="font-medium text-text">
                    {promo.discount_type === 'percentage'
                      ? `${promo.discount_value}%`
                      : formatCurrency(promo.discount_value)}
                  </span>
                </div>
                {promo.min_order && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Min order</span>
                    <span className="text-text">{formatCurrency(promo.min_order)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">Uses</span>
                  <span className="text-text">{promo.current_uses}{promo.max_uses ? `/${promo.max_uses}` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Period</span>
                  <span className="text-text text-xs">
                    {formatDate(promo.starts_at)} — {promo.expires_at ? formatDate(promo.expires_at) : 'No end'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => openEdit(promo)}>
                  <Pencil size={12} /> Edit
                </Button>
                <button
                  onClick={() => handleToggleActive(promo)}
                  className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border ${
                    promo.is_active ? 'border-green-200 text-green-700 bg-green-50' : 'border-gray-200 text-text-secondary bg-gray-50'
                  }`}
                >
                  {promo.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {promo.is_active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(promo)}
                  className="ml-auto p-1.5 rounded hover:bg-red-50 text-text-secondary hover:text-error"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Promotion' : 'Create Promotion'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Promo Code" name="code" placeholder="e.g. SUMMER20" value={form.code} onChange={handleChange} required />
          <Input label="Description" name="description" value={form.description} onChange={handleChange} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Type</label>
              <select
                name="discountType"
                value={form.discountType}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
            <Input
              label={form.discountType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
              name="discountValue"
              type="number"
              step="0.01"
              value={form.discountValue}
              onChange={handleChange}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" name="startsAt" type="datetime-local" value={form.startsAt} onChange={handleChange} required />
            <Input label="End Date" name="expiresAt" type="datetime-local" value={form.expiresAt} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Max Uses" name="maxUses" type="number" placeholder="Unlimited" value={form.maxUses} onChange={handleChange} />
            <Input label="Min Order Amount" name="minOrder" type="number" step="0.01" placeholder="0.00" value={form.minOrder} onChange={handleChange} />
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update Promotion' : 'Create Promotion'}
          </Button>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Promotion">
        <div className="space-y-4">
          <p className="text-sm text-text">
            Are you sure you want to delete promotion <strong>{showDeleteConfirm?.code}</strong>?
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button variant="accent" className="flex-1 !bg-error hover:!bg-red-700" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
