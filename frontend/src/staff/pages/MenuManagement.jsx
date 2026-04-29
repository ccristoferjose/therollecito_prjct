import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Package, MapPin, ChevronDown, ChevronRight, Upload, Image as ImageIcon } from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Input from '@shared/components/Input';
import Modal from '@shared/components/Modal';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

export default function MenuManagement() {
  const { token } = useStaffAuth();
  const { data: menuData, loading, refetch } = useFetch('/menu/all', token);
  const { data: locations } = useFetch('/locations', token);
  const [expandedCats, setExpandedCats] = useState({});
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [itemForm, setItemForm] = useState({
    categoryId: '', name: '', price: '', description: '', locationIds: [],
    imageUrl: '', imageBase64: null,
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState(null);
  const fileInputRef = useRef(null);
  const [catForm, setCatForm] = useState({ menuId: '', name: '', description: '' });

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];
  const itemLocations = menuData?.itemLocations || [];
  const menus = menuData?.menus || [];

  function getItemLocationIds(itemId) {
    return itemLocations.filter((il) => il.item_id === itemId).map((il) => il.location_id);
  }

  function toggleCat(catId) {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }

  function openCreateItem(categoryId) {
    setEditingItem(null);
    setImageError(null);
    setItemForm({
      categoryId: categoryId || '', name: '', price: '', description: '',
      locationIds: (locations || []).map((l) => l.id),
      imageUrl: '', imageBase64: null,
    });
    setShowItemModal(true);
  }

  function openEditItem(item) {
    setEditingItem(item);
    setImageError(null);
    setItemForm({
      categoryId: item.category_id,
      name: item.name,
      price: String(item.price),
      description: item.description || '',
      locationIds: getItemLocationIds(item.id),
      imageUrl: item.image_url || '',
      imageBase64: null,
    });
    setShowItemModal(true);
  }

  function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError('Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setItemForm((p) => ({ ...p, imageBase64: reader.result, imageUrl: reader.result }));
    };
    reader.onerror = () => setImageError('Failed to read image file.');
    reader.readAsDataURL(file);
  }

  function openCreateCat() {
    setEditingCat(null);
    setCatForm({ menuId: menus[0]?.id || '', name: '', description: '' });
    setShowCatModal(true);
  }

  function openEditCat(cat) {
    setEditingCat(cat);
    setCatForm({ menuId: cat.menu_id, name: cat.name, description: cat.description || '' });
    setShowCatModal(true);
  }

  function toggleLocation(locId) {
    setItemForm((prev) => ({
      ...prev,
      locationIds: prev.locationIds.includes(locId)
        ? prev.locationIds.filter((id) => id !== locId)
        : [...prev.locationIds, locId],
    }));
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    setSaving(true);
    setImageError(null);
    try {
      let itemId;
      if (editingItem) {
        await api.patch(`/menu/items/${editingItem.id}`, {
          name: itemForm.name,
          price: parseFloat(itemForm.price),
          description: itemForm.description || null,
        }, token);
        await api.put(`/menu/items/${editingItem.id}/locations`, {
          location_ids: itemForm.locationIds,
        }, token);
        itemId = editingItem.id;
      } else {
        const created = await api.post('/menu/items', {
          categoryId: Number(itemForm.categoryId),
          name: itemForm.name,
          price: parseFloat(itemForm.price),
          description: itemForm.description || null,
        }, token);
        await api.put(`/menu/items/${created.id}/locations`, {
          location_ids: itemForm.locationIds,
        }, token);
        itemId = created.id;
      }

      // Upload image if a new one was selected
      if (itemForm.imageBase64) {
        setImageUploading(true);
        try {
          await api.post(`/uploads/menu-items/${itemId}/image`, {
            image_base64: itemForm.imageBase64,
          }, token);
        } catch (err) {
          setImageError(err?.message || 'Image upload failed. The item was saved but without an image.');
          setImageUploading(false);
          setSaving(false);
          refetch();
          return;
        }
        setImageUploading(false);
      }

      setShowItemModal(false);
      refetch();
    } catch { /* handled */ } finally {
      setSaving(false);
    }
  }

  async function handleSaveCat(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingCat) {
        await api.patch(`/menu/categories/${editingCat.id}`, {
          name: catForm.name,
          description: catForm.description || null,
        }, token);
      } else {
        await api.post('/menu/categories', {
          menuId: Number(catForm.menuId),
          name: catForm.name,
          description: catForm.description || null,
        }, token);
      }
      setShowCatModal(false);
      refetch();
    } catch { /* handled */ } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!showDeleteConfirm) return;
    setSaving(true);
    try {
      if (showDeleteConfirm.type === 'item') {
        await api.delete(`/menu/items/${showDeleteConfirm.id}`, token);
      } else {
        await api.delete(`/menu/categories/${showDeleteConfirm.id}`, token);
      }
      setShowDeleteConfirm(null);
      refetch();
    } catch { /* handled */ } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item) {
    await api.patch(`/menu/items/${item.id}`, {
      isActive: item.is_active ? 0 : 1,
    }, token);
    refetch();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text">Menu Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openCreateCat}>
            <Plus size={14} /> Add Category
          </Button>
          <Button variant="primary" size="sm" onClick={() => openCreateItem('')}>
            <Plus size={14} /> Add Item
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={Package} title="No menu items yet" description="Create categories and add items to your menu." />
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            const isExpanded = expandedCats[cat.id] !== false;
            return (
              <Card key={cat.id} padding={false}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleCat(cat.id)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <h3 className="font-semibold text-text">{cat.name}</h3>
                    <span className="text-xs text-text-secondary">({catItems.length} items)</span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditCat(cat)} className="p-1.5 rounded hover:bg-gray-100 text-text-secondary">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setShowDeleteConfirm({ type: 'category', id: cat.id, name: cat.name })} className="p-1.5 rounded hover:bg-red-50 text-text-secondary hover:text-error">
                      <Trash2 size={14} />
                    </button>
                    <Button variant="outline" size="sm" onClick={() => openCreateItem(cat.id)} className="ml-2">
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>
                {isExpanded && catItems.length > 0 && (
                  <div className="border-t border-border divide-y divide-border">
                    {catItems.map((item) => {
                      const locs = getItemLocationIds(item.id);
                      return (
                        <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${!item.is_active ? 'opacity-50' : ''}`}>
                          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary-light flex items-center justify-center overflow-hidden">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-lg">🍤</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-text truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm font-semibold text-primary-dark">{formatCurrency(item.price)}</span>
                              <div className="flex items-center gap-1">
                                <MapPin size={10} className="text-text-secondary" />
                                <span className="text-[11px] text-text-secondary">
                                  {locs.length === (locations || []).length
                                    ? 'All locations'
                                    : `${locs.length} location${locs.length !== 1 ? 's' : ''}`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`text-xs px-2 py-1 rounded-full border ${item.is_active ? 'border-green-200 text-green-700 bg-green-50' : 'border-gray-200 text-text-secondary bg-gray-50'}`}
                            >
                              {item.is_active ? 'Active' : 'Inactive'}
                            </button>
                            <button onClick={() => openEditItem(item)} className="p-1.5 rounded hover:bg-gray-100 text-text-secondary">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setShowDeleteConfirm({ type: 'item', id: item.id, name: item.name })} className="p-1.5 rounded hover:bg-red-50 text-text-secondary hover:text-error">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Item Modal */}
      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title={editingItem ? 'Edit Item' : 'Add Menu Item'}>
        <form onSubmit={handleSaveItem} className="space-y-4">
          {!editingItem && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Category</label>
              <select
                value={itemForm.categoryId}
                onChange={(e) => setItemForm((p) => ({ ...p, categoryId: e.target.value }))}
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <Input label="Name" value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} required />
          <Input label="Price" type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm((p) => ({ ...p, price: e.target.value }))} required />
          <Input label="Description" value={itemForm.description} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} />

          <div>
            <label className="block text-sm font-medium text-text mb-2">Photo</label>
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-100 border border-border flex items-center justify-center overflow-hidden">
                {itemForm.imageUrl ? (
                  <img src={itemForm.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon size={24} className="text-text-secondary" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePickImage}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving || imageUploading}
                >
                  <Upload size={14} />
                  {itemForm.imageBase64 ? 'Change photo' : itemForm.imageUrl ? 'Replace photo' : 'Upload photo'}
                </Button>
                <p className="text-[11px] text-text-secondary mt-1">JPEG, PNG or WebP. Max 5MB.</p>
                {imageError && <p className="text-[11px] text-error mt-1">{imageError}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">Available at Locations</label>
            <div className="space-y-1.5">
              {(locations || []).map((loc) => (
                <label key={loc.id} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={itemForm.locationIds.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <MapPin size={14} className="text-text-secondary" />
                  <span className="text-sm text-text">{loc.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
          </Button>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal open={showCatModal} onClose={() => setShowCatModal(false)} title={editingCat ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleSaveCat} className="space-y-4">
          <Input label="Name" value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} required />
          <Input label="Description" value={catForm.description} onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))} />
          <Button type="submit" variant="primary" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : editingCat ? 'Update Category' : 'Create Category'}
          </Button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Confirm Delete">
        <div className="space-y-4">
          <p className="text-sm text-text">
            Are you sure you want to delete <strong>{showDeleteConfirm?.name}</strong>?
            {showDeleteConfirm?.type === 'category' && ' This will also delete all items in this category.'}
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
