import { api } from '@/lib/api/client';
import type { Location } from '@/lib/types';

/**
 * Server-side location fetch (ISR, 5-min revalidate). Resilient: returns [] if
 * the backend is unreachable so SSG/build never fails on a cold backend.
 */
export async function getLocations(): Promise<Location[]> {
  try {
    return await api.get<Location[]>('/locations', null, { next: { revalidate: 300 } });
  } catch {
    return [];
  }
}

/**
 * Single active location by id, derived from the list (the public API exposes
 * only the list endpoint). Next dedupes the underlying fetch within a render.
 */
export async function getLocation(id: number): Promise<Location | null> {
  const locations = await getLocations();
  return locations.find((l) => l.id === id) ?? null;
}
