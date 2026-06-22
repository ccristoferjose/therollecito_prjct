import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, MapPin, ShieldCheck, Sparkles, Heart, Leaf, Star } from 'lucide-react';
import en from '@/lib/i18n/en';
import { getLocations } from '@/features/locations/queries';
import { getMenuForLocation } from '@/features/menu/queries';
import { formatCurrency } from '@/lib/utils/format';
import { brandJsonLd } from '@/lib/seo/schema';
import { env } from '@/lib/config/env';
import JsonLd from '@/components/seo/json-ld';
import LocationPicker from '@/features/locations/location-picker';
import type { MenuItem } from '@/lib/types';

// SEO-sensitive, server-data-driven landing → Server Component + ISR.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Order fresh-baked rolls online for pickup',
  description:
    'Browse the menu, order online, and pick up fresh-baked rolls at your nearest The Rollecito location. No account required.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'The Rollecito — order online, pick up fresh',
    description: 'Fresh-baked rolls, ordered online for pickup at a location near you.',
  },
};

const t = en;

async function getFeatured(): Promise<MenuItem[]> {
  const locations = await getLocations();
  const firstLocationId = locations[0]?.id;
  if (!firstLocationId) return [];
  const menu = await getMenuForLocation(firstLocationId);
  const items = menu?.items ?? [];
  const withImages = items.filter((i) => i.image_url && i.is_active !== 0);
  return (withImages.length >= 4 ? withImages : items).slice(0, 4);
}

export default async function LandingPage() {
  const [featured, locations] = await Promise.all([getFeatured(), getLocations()]);

  const features = [
    { icon: Clock, title: t.features.quickPickup, desc: t.features.quickPickupDesc },
    { icon: MapPin, title: t.features.multipleLocations, desc: t.features.multipleLocationsDesc },
    { icon: ShieldCheck, title: t.features.securePayments, desc: t.features.securePaymentsDesc },
  ];
  const aboutPills = [
    { icon: Heart, label: t.about.pillOne },
    { icon: Sparkles, label: t.about.pillTwo },
    { icon: Leaf, label: t.about.pillThree },
  ];

  return (
    <>
      <JsonLd data={brandJsonLd(env.siteUrl)} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFF1DC] via-[#F2D6B3] to-[#F4A261]/40" />
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#F4A261]/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-[#D98C5F]/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-semibold text-primary-dark shadow-sm backdrop-blur">
                <Sparkles size={14} className="text-accent-hover" />
                {t.hero.madeDaily}
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight text-primary-dark sm:text-5xl lg:text-6xl">
                {t.hero.title}{' '}
                <span className="bg-gradient-to-r from-[#A86A4A] to-[#E76F51] bg-clip-text text-transparent">
                  {t.hero.titleHighlight}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-dark/80">{t.hero.subtitle}</p>
              {/* Primary CTA — clear "order online → pick up at a location". */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/order"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-text-inverse shadow-[var(--shadow-warm)] transition-colors hover:bg-accent-hover"
                >
                  {t.hero.orderNow} &amp; pick up
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/locations"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-primary-dark px-7 py-3.5 text-base font-semibold text-primary-dark transition-colors hover:bg-primary-dark hover:text-text-inverse"
                >
                  <MapPin size={18} />
                  {t.hero.viewLocations}
                </Link>
              </div>

              {/* Order-online → pick-up-at-a-location picker */}
              <LocationPicker locations={locations} />

              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-primary-dark/70">
                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={16} className="fill-accent text-accent" />
                    ))}
                  </div>
                  <span className="font-semibold">4.9</span>
                  <span>average rating</span>
                </div>
                <div className="h-4 w-px bg-primary-dark/20" />
                <span>Warm pickup in 15 min</span>
              </div>
            </div>
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative">
                <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-[#F4A261]/40 to-[#E76F51]/20 blur-2xl" />
                <div className="relative animate-float drop-shadow-[0_18px_30px_rgba(74,58,53,0.25)]">
                  <Image
                    src="/cinnamon_roll_mascot.png"
                    alt="The Rollecito cinnamon roll mascot"
                    width={320}
                    height={320}
                    priority
                    className="h-72 w-72 object-contain sm:h-80 sm:w-80"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-[#FFF1DC]">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-primary-dark sm:text-4xl">{t.favorites.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-dark/70">{t.favorites.subtitle}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.length > 0
              ? featured.map((item) => (
                  <article
                    key={item.id}
                    className="group flex flex-col rounded-3xl bg-[#F2D6B3] p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
                  >
                    <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#F4A261]/60 to-[#D98C5F]/50">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-6xl">🥐</span>
                      )}
                    </div>
                    <h3 className="mt-4 line-clamp-1 text-lg font-bold text-primary-dark">{item.name}</h3>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 flex-1 text-sm text-primary-dark/70">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xl font-extrabold text-primary">{formatCurrency(item.price)}</span>
                      <Link
                        href="/order"
                        className="rounded-full bg-primary-dark px-4 py-2 text-xs font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
                      >
                        Order
                      </Link>
                    </div>
                  </article>
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-72 animate-pulse rounded-3xl bg-[#F2D6B3]/60" />
                ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-primary-dark shadow-[var(--shadow-warm)] transition-colors hover:bg-accent-hover hover:text-text-inverse"
            >
              {t.favorites.viewFullMenu}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ABOUT + features */}
      <section id="about" className="bg-[#FFF1DC]">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <div className="absolute inset-0 -m-4 rotate-3 rounded-[3rem] bg-[#F2D6B3]/70" />
              <div className="relative rounded-[3rem] bg-[#F4A261]/30 p-10 shadow-[var(--shadow-warm)] sm:p-14">
                <Image
                  src="/cinnamon_roll_mascot.png"
                  alt=""
                  aria-hidden
                  width={224}
                  height={224}
                  className="mx-auto h-56 w-56 object-contain"
                />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-primary-dark sm:text-4xl">{t.about.title}</h2>
              <p className="mt-5 text-lg leading-relaxed text-primary-dark/80">{t.about.body}</p>
              <ul className="mt-8 space-y-3">
                {aboutPills.map((p) => (
                  <li key={p.label} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
                      <p.icon size={18} className="text-accent-hover" />
                    </span>
                    <span className="font-semibold text-primary-dark">{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-20 grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-transparent bg-[#F2D6B3] p-6 text-center shadow-[var(--shadow-card)]"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/30">
                  <f.icon size={22} className="text-accent-hover" />
                </div>
                <h3 className="font-bold text-primary-dark">{f.title}</h3>
                <p className="mt-1 text-sm text-primary-dark/75">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-[#F2D6B3]/50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-primary-dark sm:text-4xl">{t.testimonials.title}</h2>
            <p className="mt-3 text-primary-dark/70">{t.testimonials.subtitle}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {t.testimonials.items.map((item, idx) => (
              <figure
                key={idx}
                className="flex flex-col rounded-3xl bg-surface p-7 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
              >
                <div className="flex text-accent">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={16} className="fill-accent" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 leading-relaxed text-primary-dark/85">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                    {item.name.charAt(0)}
                  </span>
                  <span className="font-semibold text-primary-dark">{item.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#A86A4A] to-[#4A3A35]" />
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-[#F4A261]/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#E76F51]/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-3xl font-extrabold leading-tight text-[#FFF1DC] sm:text-5xl">{t.cta.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#FFF1DC]/85">{t.cta.subtitle}</p>
          <div className="mt-8">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-lg font-semibold text-primary-dark shadow-[var(--shadow-warm)] transition-colors hover:bg-accent-hover hover:text-text-inverse"
            >
              {t.cta.startOrder}
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
