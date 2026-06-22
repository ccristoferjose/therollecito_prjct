import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Phone, ArrowRight } from 'lucide-react';
import en from '@/lib/i18n/en';
import { getLocations } from '@/features/locations/queries';
import { locationListJsonLd } from '@/lib/seo/schema';
import { env } from '@/lib/config/env';
import Card from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import JsonLd from '@/components/seo/json-ld';

export const revalidate = 300;

const t = en;

export const metadata: Metadata = {
  title: t.locationsPage.title,
  description: t.locationsPage.subtitle,
  alternates: { canonical: '/locations' },
};

export default async function LocationsPage() {
  const locations = await getLocations();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {locations.length > 0 && <JsonLd data={locationListJsonLd(locations, env.siteUrl)} />}
      <h1 className="text-2xl font-bold text-text">{t.locationsPage.title}</h1>
      <p className="mt-1 text-text-secondary">{t.locationsPage.subtitle}</p>

      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t.locationsPage.noLocations}
          description={t.locationsPage.checkBack}
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <Card key={loc.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                  <MapPin size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-text">
                    <Link href={`/locations/${loc.id}`} className="hover:text-primary hover:underline">
                      {loc.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {loc.address}, {loc.city}, {loc.state} {loc.zip_code}
                  </p>
                </div>
              </div>
              {loc.phone && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Phone size={14} />
                  {loc.phone}
                </div>
              )}
              <Link
                href={`/order?location=${loc.id}`}
                className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark transition-colors hover:bg-primary-dark hover:text-text-inverse"
              >
                {t.locationsPage.orderHere} <ArrowRight size={16} />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
