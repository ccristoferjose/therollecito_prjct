'use client';

import { useState } from 'react';
import { UserPlus, MapPin, Shield, ChefHat, ToggleLeft, ToggleRight, Trash2, Pencil } from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Modal from '@/components/ui/modal';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import type { Location, StaffMember } from '@/lib/types';

interface CreateForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  locationId: number | string;
}
interface EditForm {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  locationId: number | string;
  password: string;
  confirmPassword: string;
}

const emptyCreate: CreateForm = { email: '', password: '', firstName: '', lastName: '', role: 'manager', phone: '', locationId: '' };
const emptyEdit: EditForm = { email: '', firstName: '', lastName: '', phone: '', role: 'manager', locationId: '', password: '', confirmPassword: '' };

export default function UserManagement() {
  const { token, user: currentUser } = useStaffAuth();
  const { data: staff, loading, refetch } = useFetch<StaffMember[]>('/users/staff', token);
  const { data: locations } = useFetch<Location[]>('/locations', token);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<CreateForm>({ ...emptyCreate });
  const [editUser, setEditUser] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ ...emptyEdit });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  function openEdit(user: StaffMember) {
    setEditUser(user);
    setEditForm({
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone || '',
      role: user.role_name,
      locationId: user.location_id || '',
      password: '',
      confirmPassword: '',
    });
    setError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const newPassword = editForm.password || '';
    if (newPassword) {
      if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
      if (newPassword !== editForm.confirmPassword) return setError('Passwords do not match.');
    }
    if (!editUser) return;
    setSaving(true);
    try {
      // Profile fields only — the password has its own endpoint.
      const { password, confirmPassword, ...profile } = editForm;
      void password;
      void confirmPassword;
      await api.put(`/users/${editUser.id}`, profile, token);
      if (newPassword) await api.patch(`/users/${editUser.id}/password`, { password: newPassword }, token);
      setEditUser(null);
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/users/staff', form, token);
      setShowModal(false);
      setForm({ ...emptyCreate });
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(userId: number, currentlyActive: boolean | number) {
    try {
      await api.patch(`/users/${userId}/active`, { is_active: !currentlyActive }, token);
      refetch();
    } catch {
      /* handled */
    }
  }

  async function handleDelete(userId: number) {
    try {
      await api.delete(`/users/${userId}`, token);
      setConfirmDelete(null);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete.');
    }
  }

  const staffList = Array.isArray(staff) ? staff : [];
  const editingSelf = !!editUser && editUser.id === currentUser?.id;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">User Management</h2>
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          <UserPlus size={14} /> Create Staff
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : staffList.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No staff accounts"
          description="Create admin and manager accounts to get started."
          action={
            <Button variant="primary" onClick={() => setShowModal(true)}>
              <UserPlus size={14} /> Create First Staff
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {staffList.map((user) => {
            const isSelf = user.id === currentUser?.id;
            return (
              <Card key={user.id} className={`flex items-center gap-4 ${!user.is_active ? 'opacity-60' : ''}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${user.is_active ? 'bg-primary-light' : 'bg-gray-100'}`}>
                  {user.role_name === 'admin' ? (
                    <Shield size={18} className={user.is_active ? 'text-primary' : 'text-text-secondary'} />
                  ) : (
                    <ChefHat size={18} className={user.is_active ? 'text-primary' : 'text-text-secondary'} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-text">
                      {user.first_name} {user.last_name}
                    </p>
                    <Badge status={user.role_name === 'admin' ? 'PAID' : 'PREPARING'}>{user.role_name}</Badge>
                    {!user.is_active && <Badge status="default">disabled</Badge>}
                    {isSelf && <span className="text-[10px] text-text-secondary">(you)</span>}
                  </div>
                  <p className="truncate text-sm text-text-secondary">{user.email}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-3 text-sm text-text-secondary sm:flex">
                  {user.location_name && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {user.location_name}
                    </span>
                  )}
                  <span>{formatDate(user.created_at)}</span>
                </div>
                {/* Edit shows on every row (incl. your own → change your password);
                    disable/delete stay hidden for your own account. */}
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => openEdit(user)} className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-gray-100" title="Edit user / change password">
                    <Pencil size={16} />
                  </button>
                  {!isSelf && (
                    <>
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`rounded-lg p-2 transition-colors ${user.is_active ? 'text-success hover:bg-green-50' : 'text-text-secondary hover:bg-gray-100'}`}
                        title={user.is_active ? 'Disable user' : 'Enable user'}
                      >
                        {user.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      {!user.is_active && (
                        <button onClick={() => setConfirmDelete(user)} className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-red-50 hover:text-error" title="Delete user">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create staff modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Staff Account">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="firstName" value={form.firstName} onChange={handleChange} required />
            <Input label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} required />
          </div>
          <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} required />
          <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} required />
          <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Role</label>
            <select name="role" value={form.role} onChange={handleChange} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="manager">Manager (Kitchen)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Assigned Location</label>
            <select name="locationId" value={form.locationId} onChange={handleChange} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">No location (admin)</option>
              {(locations || []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} — {loc.city}, {loc.state}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">Kitchen managers see orders only from their assigned location.</p>
          </div>
          {error && <div className="rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error">{error}</div>}
          <Button type="submit" variant="primary" className="w-full" disabled={saving}>
            {saving ? 'Creating...' : 'Create Account'}
          </Button>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Staff Account">
        {confirmDelete && (
          <div className="space-y-4">
            <p className="text-sm text-text">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold">
                {confirmDelete.first_name} {confirmDelete.last_name}
              </span>{' '}
              ({confirmDelete.email})?
            </p>
            <p className="text-xs text-text-secondary">This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(confirmDelete.id)}>
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit staff modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit Staff Account">
        {editUser && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" name="firstName" value={editForm.firstName} onChange={handleEditChange} required />
              <Input label="Last Name" name="lastName" value={editForm.lastName} onChange={handleEditChange} required />
            </div>
            <Input label="Email" name="email" type="email" value={editForm.email} onChange={handleEditChange} required />
            <Input label="Phone" name="phone" value={editForm.phone} onChange={handleEditChange} />
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Role</label>
              <select
                name="role"
                value={editForm.role}
                onChange={handleEditChange}
                disabled={editingSelf}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="manager">Manager (Kitchen)</option>
                <option value="admin">Admin</option>
              </select>
              {editingSelf && <p className="mt-1 text-xs text-text-secondary">You can&apos;t change your own role.</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Assigned Location</label>
              <select name="locationId" value={editForm.locationId} onChange={handleEditChange} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">No location (admin)</option>
                {(locations || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} — {loc.city}, {loc.state}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-text">{editingSelf ? 'Change your password' : 'Change password'}</p>
              <p className="mb-3 text-xs text-text-secondary">Leave blank to keep the current password.</p>
              <div className="space-y-4">
                <Input label="New Password" name="password" type="password" value={editForm.password} onChange={handleEditChange} autoComplete="new-password" />
                <Input label="Confirm New Password" name="confirmPassword" type="password" value={editForm.confirmPassword} onChange={handleEditChange} autoComplete="new-password" />
              </div>
            </div>

            {error && <div className="rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error">{error}</div>}
            <Button type="submit" variant="primary" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
