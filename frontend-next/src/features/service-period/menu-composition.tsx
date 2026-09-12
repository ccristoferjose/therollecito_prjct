'use client';

import { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, X, AlertTriangle, Link2 } from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { api, ApiError } from '@/lib/api/client';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import type { MenuSummary } from './types';

interface CategoryRow {
  id: number;
  menu_id: number;
  name: string;
  sort_order: number;
}
interface ItemRow {
  id: number;
  category_id: number;
  name: string;
}
interface MenuCategoryRow {
  menu_id: number;
  category_id: number;
  sort_order: number;
  menu_name: string;
  category_name: string;
  home_menu_id: number;
}

/**
 * Which categories each menu contains.
 *
 * This is where a product gets associated with a service period. The link is
 * indirect by design:
 *
 *     service_period -> menu -> category -> item
 *
 * Because a category can sit on SEVERAL menus (migration 006), one product can
 * be sold in several periods while remaining a single item row — same id, same
 * price, same options, one line in reporting. Attaching "Drinks" to both the
 * breakfast and lunch menus is what makes coffee available all day.
 */
export default function MenuComposition() {
  const { token } = useStaffAuth();
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [pairs, setPairs] = useState<MenuCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, mc] = await Promise.all([
        api.get<{ menus: MenuSummary[]; categories: CategoryRow[]; items: ItemRow[] }>(
          '/menu/all',
          token,
        ),
        api.get<MenuCategoryRow[]>('/menu/categories/menus', token),
      ]);
      setMenus(all.menus || []);
      setCategories(all.categories || []);
      setItems(all.items || []);
      setPairs(Array.isArray(mc) ? mc : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load menu composition');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemCount = (categoryId: number) =>
    items.filter((i) => i.category_id === categoryId).length;

  /** How many menus a category is on — >1 means it is shared. */
  const menuCountFor = (categoryId: number) =>
    pairs.filter((p) => p.category_id === categoryId).length;

  const categoriesOn = (menuId: number) =>
    pairs
      .filter((p) => p.menu_id === menuId)
      .sort((a, b) => a.sort_order - b.sort_order);

  const notOn = (menuId: number) =>
    categories.filter((c) => !pairs.some((p) => p.menu_id === menuId && p.category_id === c.id));

  async function attach(menuId: number, categoryId: number) {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/menu/${menuId}/categories/${categoryId}`, {}, token);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that category');
    } finally {
      setBusy(false);
    }
  }

  async function detach(menuId: number, categoryId: number) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/menu/${menuId}/categories/${categoryId}`, token);
      await load();
    } catch (err) {
      // The server refuses to leave a category with no menu at all.
      setError(err instanceof ApiError ? err.message : 'Could not remove that category');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeMenus = menus.filter((m) => m.is_active);

  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-text">
          <Layers size={18} /> Menu composition
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Which categories each menu contains — this is what decides whether a product is
          available in a given service period. A category on more than one menu lets the same
          product be sold in several periods without duplicating it.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-error bg-red-50 px-4 py-3 text-sm text-error"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {activeMenus.map((menu) => {
          const attached = categoriesOn(menu.id);
          const available = notOn(menu.id);
          return (
            <Card key={menu.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-text">{menu.name}</h3>
                <span className="text-xs text-text-secondary">
                  {attached.reduce((n, p) => n + itemCount(p.category_id), 0)} products
                </span>
              </div>

              {attached.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No categories yet — this menu would show nothing to customers.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {attached.map((p) => {
                    const shared = menuCountFor(p.category_id) > 1;
                    return (
                      <span
                        key={`${p.menu_id}-${p.category_id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium text-text">{p.category_name}</span>
                        <span className="text-xs text-text-secondary">
                          {itemCount(p.category_id)}
                        </span>
                        {/* twMerge lets className win over the default palette —
                            the status keys are order statuses, not a general
                            colour API, so borrowing one here would be misleading. */}
                        {shared && (
                          <Badge className="bg-amber-50 text-amber-700">
                            <Link2 size={10} className="mr-0.5 inline" /> shared
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => detach(menu.id, p.category_id)}
                          disabled={busy}
                          aria-label={`Remove ${p.category_name} from ${menu.name}`}
                          className="text-text-secondary hover:text-error"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {available.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <Plus size={14} className="text-text-secondary" />
                  <select
                    defaultValue=""
                    disabled={busy}
                    aria-label={`Add a category to ${menu.name}`}
                    onChange={(e) => {
                      if (e.target.value) {
                        void attach(menu.id, Number(e.target.value));
                        e.target.value = '';
                      }
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Add a category…</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({itemCount(c.id)} products)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-text-secondary">
        A category must stay on at least one menu — otherwise its products would disappear from
        every period with no visible cause, so removing the last one is rejected.
      </p>
    </div>
  );
}
