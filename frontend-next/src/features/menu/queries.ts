import { api } from '@/lib/api/client';
import type { MenuData, MenuItem } from '@/lib/types';

/** Server-side menu fetch for a location (ISR). Resilient on cold backend. */
export async function getMenuForLocation(locationId: number): Promise<MenuData | null> {
  try {
    return await api.get<MenuData>(`/menu/location/${locationId}`, null, {
      next: { revalidate: 300 },
    });
  } catch {
    return null;
  }
}

/**
 * Landing-page showcase: active items sold at any active location (photos
 * first). Independent of which location or pickup time a visitor picks.
 */
export async function getFeaturedItems(limit = 4): Promise<MenuItem[]> {
  try {
    const res = await api.get<{ items: MenuItem[] }>(`/menu/featured?limit=${limit}`, null, {
      next: { revalidate: 300 },
    });
    return res?.items ?? [];
  } catch {
    return [];
  }
}
