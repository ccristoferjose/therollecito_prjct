import { useState } from 'react';
import { UserPlus, MapPin, Shield, ChefHat, ToggleLeft, ToggleRight, Trash2, Pencil } from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatDate } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Input from '@shared/components/Input';
import Modal from '@shared/components/Modal';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

export default function UserManagement() {
  const { token, user: currentUser } = useStaffAuth();
  const { data: staff, loading, refetch } = useFetch('/users/staff', token);
  const { data: locations } = useFetch('/locations', token);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'manager',
    phone: '',
    locationId: '',
  });
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleEditChange = (e) =>
    setEditForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  function openEdit(user) {
    setEditUser(user);
    setEditForm({
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone || '',
      role: user.role_name,
      locationId: user.location_id || '',
    });
    setError(null);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put(`/users/${editUser.id}`, editForm, token);
      setEditUser(null);
      refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/users/staff', form, token);
      setShowModal(false);
      setForm({
        email: '', password: '', firstName: '', lastName: '',
        role: 'manager', phone: '', locationId: '',
      });
      refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(userId, currentlyActive) {
    try {
      await api.patch(`/users/${userId}/active`, { is_active: !currentlyActive }, token);
      refetch();
    } catch {
      // handled by error handler
    }
  }

  async function handleDelete(userId) {
    try {
      await api.delete(`/users/${userId}`, token);
      setConfirmDelete(null);
      refetch();
    } catch (err) {
      alert(err.message);
    }
  }

  const staffList = Array.isArray(staff) ? staff : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text">User Management</h2>
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          <UserPlus size={14} /> Create Staff
        </Button>
      </div>

      {/* Staff list */}
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
              <Card
                key={user.id}
                className={`flex items-center gap-4 ${!user.is_active ? 'opacity-60' : ''}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${user.is_active ? 'bg-primary-light' : 'bg-gray-100'}`}>
                  {user.role_name === 'admin' ? (
                    <Shield size={18} className={user.is_active ? 'text-primary' : 'text-text-secondary'} />
                  ) : (
                    <ChefHat size={18} className={user.is_active ? 'text-primary' : 'text-text-secondary'} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text truncate">
                      {user.first_name} {user.last_name}
                    </p>
                    <Badge status={user.role_name === 'admin' ? 'PAID' : 'PREPARING'}>
                      {user.role_name}
                    </Badge>
                    {!user.is_active && (
                      <Badge status="default">disabled</Badge>
                    )}
                    {isSelf && (
                      <span className="text-[10px] text-text-secondary">(you)</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary truncate">{user.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-sm text-text-secondary shrink-0">
                  {user.location_name && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {user.location_name}
                    </span>
                  )}
                  <span>{formatDate(user.created_at)}</span>
                </div>
                {/* Actions */}
                {!isSelf && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(user)}
                      className="rounded-lg p-2 text-text-secondary hover:bg-gray-100 transition-colors"
                      title="Edit user"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className={`rounded-lg p-2 transition-colors ${
                        user.is_active
                          ? 'text-success hover:bg-green-50'
                          : 'text-text-secondary hover:bg-gray-100'
                      }`}
                      title={user.is_active ? 'Disable user' : 'Enable user'}
                    >
                      {user.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    {!user.is_active && (
                      <button
                        onClick={() => setConfirmDelete(user)}
                        className="rounded-lg p-2 text-text-secondary hover:text-error hover:bg-red-50 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
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
            <label className="block text-sm font-medium text-text mb-1">Role</label>
            <select name="role" value={form.role} onChange={handleChange}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="manager">Manager (Kitchen)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Assigned Location</label>
            <select name="locationId" value={form.locationId} onChange={handleChange}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">No location (admin)</option>
              {(locations || []).map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              Kitchen managers see orders only from their assigned location.
            </p>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-error/20 p-3 text-sm text-error">{error}</div>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={saving}>
            {saving ? 'Creating...' : 'Create Account'}
          </Button>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Staff Account"
      >
        {confirmDelete && (
          <div className="space-y-4">
            <p className="text-sm text-text">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold">{confirmDelete.first_name} {confirmDelete.last_name}</span>{' '}
              ({confirmDelete.email})?
            </p>
            <p className="text-xs text-text-secondary">
              This action cannot be undone.
            </p>
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
              <label className="block text-sm font-medium text-text mb-1">Role</label>
              <select name="role" value={editForm.role} onChange={handleEditChange}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="manager">Manager (Kitchen)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Assigned Location</label>
              <select name="locationId" value={editForm.locationId} onChange={handleEditChange}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">No location (admin)</option>
                {(locations || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</option>
                ))}
              </select>
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-error/20 p-3 text-sm text-error">{error}</div>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
