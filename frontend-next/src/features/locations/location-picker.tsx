'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowRight } from 'lucide-react';
import type { Location } from '@/lib/types';

/**
 * Hero "order online → pick up at a location" picker. Choose a location and go
 * straight into the order flow for it. Renders nothing if there are no
 * locations (the hero's standalone CTA still covers ordering).
 */
export default function LocationPicker({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [id, setId] = useState('');

  if (locations.length === 0) return null;

  const start = () => router.push(id ? `/order?location=${id}` : '/order');

  return (
    <div className="mt-8 flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
        <MapPin size={18} className="shrink-0 text-primary" />
        <select
          value={id}
          onChange={(e) => setId(e.target.value)}
          aria-label="Choose a pickup location"
          className="w-full bg-transparent py-2.5 text-sm text-text focus:outline-none"
        >
          <option value="">Choose a pickup location…</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} — {loc.city}, {loc.state}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={start}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-text-inverse shadow-[var(--shadow-warm)] transition-colors hover:bg-accent-hover"
      >
        Order &amp; pick up
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
