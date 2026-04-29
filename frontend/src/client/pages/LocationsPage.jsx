import { Link } from 'react-router-dom';
import { MapPin, Phone, ArrowRight } from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useFetch } from '@shared/hooks/useFetch';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

export default function LocationsPage() {
  const { t } = useLang();
  const { data: locations, loading, error } = useFetch('/locations');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-text">{t.locationsPage.title}</h1>
      <p className="mt-1 text-text-secondary">{t.locationsPage.subtitle}</p>

      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && <p className="mt-6 text-error text-sm">{error}</p>}

      {locations && locations.length === 0 && (
        <EmptyState icon={MapPin} title={t.locationsPage.noLocations} description={t.locationsPage.checkBack} />
      )}

      {locations && locations.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <Card key={loc.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                  <MapPin size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-text">{loc.name}</h3>
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
              <Link to={`/order?location=${loc.id}`} className="mt-auto">
                <Button variant="outline" className="w-full">
                  {t.locationsPage.orderHere} <ArrowRight size={16} />
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
