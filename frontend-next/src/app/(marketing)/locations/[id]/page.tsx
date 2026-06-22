import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Phone, Clock, ArrowRight } from 'lucide-react';
import { getLocations, getLocation } from '@/features/locations/queries';
import { locationJsonLd } from '@/lib/seo/schema';
import { env } from '@/lib/config/env';
import JsonLd from '@/components/seo/json-ld';
import type { Location } from '@/lib/types';

export const revalidate = 300;

// Pre-render a static page per active location (great for "near me" SEO).
export async function generateStaticParams() {
  const locations = await getLocations();
  return locations.map((l) => ({ id: String(l.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loc = await getLocation(Number(id));
  if (!loc) return { title: 'Location not found' };
  return {
    title: `${loc.name} — ${loc.city}, ${loc.state}`,
    description: `Order fresh-baked rolls online for pickup at The Rollecito ${loc.name}, ${loc.address}, ${loc.city}, ${loc.state}.`,
    alternates: { canonical: `/locations/${loc.id}` },
    openGraph: {
      title: `The Rollecito — ${loc.name}`,
      description: `Order online for pickup at ${loc.address}, ${loc.city}.`,
    },
  };
}

function formatHour(t?: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = Number(h);
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${period}`;
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loc: Location | null = await getLocation(Number(id));
  if (!loc) notFound();

  const fullAddress = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zip_code}`;
  const opens = formatHour(loc.open_time);
  const closes = formatHour(loc.close_time);
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(`The Rollecito ${fullAddress}`)}&output=embed`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd data={locationJsonLd(loc, env.siteUrl)} />

      <Link href="/locations" className="text-sm font-medium text-primary hover:underline">
        ← All locations
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-extrabold text-text">{loc.name}</h1>
          <ul className="mt-5 space-y-3 text-text-secondary">
            <li className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
              <span>{fullAddress}</span>
            </li>
            {loc.phone && (
              <li className="flex items-center gap-3">
                <Phone size={18} className="shrink-0 text-primary" />
                <a href={`tel:${loc.phone}`} className="hover:text-primary">
                  {loc.phone}
                </a>
              </li>
            )}
            <li className="flex items-center gap-3">
              <Clock size={18} className="shrink-0 text-primary" />
              <span>{opens && closes ? `Open daily ${opens} – ${closes}` : 'Open daily'}</span>
            </li>
          </ul>

          <Link
            href={`/order?location=${loc.id}`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-base font-bold text-text-inverse shadow-[var(--shadow-warm)] transition-colors hover:bg-accent-hover"
          >
            Order &amp; pick up here
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]">
          <iframe
            title={`Map to The Rollecito ${loc.name}`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-72 w-full lg:h-full"
          />
        </div>
      </div>
    </div>
  );
}
