import { api } from '@/lib/api/client';
import type { MenuData } from '@/lib/types';

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
