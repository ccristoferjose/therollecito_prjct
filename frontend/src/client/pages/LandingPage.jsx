import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Heart,
  Leaf,
  Star,
} from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useFetch } from '@shared/hooks/useFetch';
import { formatCurrency } from '@shared/utils/format';
import Button from '@shared/components/Button';
import Card from '@shared/components/Card';

export default function LandingPage() {
  const { t } = useLang();

  // Pull real menu items from the first location to power the Featured section.
  const { data: locations } = useFetch('/locations');
  const firstLocationId = locations?.[0]?.id;
  const { data: menuData } = useFetch(
    firstLocationId ? `/menu/location/${firstLocationId}` : null
  );
  const menuItems = menuData?.items || [];
  const withImages = menuItems.filter((i) => i.image_url && i.is_active !== 0);
  const featured = (withImages.length >= 4 ? withImages : menuItems).slice(0, 4);

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

  const testimonials = t.testimonials.items;

  return (
    <>
      {/* =====================================================================
          HERO
          ===================================================================== */}
      <section className="relative overflow-hidden">
        {/* warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFF1DC] via-[#F2D6B3] to-[#F4A261]/40" />
        {/* soft decorative blurs */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#F4A261]/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-[#D98C5F]/30 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-semibold text-primary-dark shadow-sm backdrop-blur">
                <Sparkles size={14} className="text-accent-hover" />
                {t.hero.madeDaily}
              </span>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-primary-dark">
                {t.hero.title}{' '}
                <span className="bg-gradient-to-r from-[#A86A4A] to-[#E76F51] bg-clip-text text-transparent">
                  {t.hero.titleHighlight}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-primary-dark/80 leading-relaxed">
                {t.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/order">
                  <Button variant="primary" size="lg">
                    {t.hero.orderNow}
                    <ArrowRight size={18} />
                  </Button>
                </Link>
                <Link to="/order">
                  <Button variant="outline" size="lg">
                    {t.hero.viewMenu}
                  </Button>
                </Link>
              </div>

              {/* trust strip */}
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
                  <img
                    src="/cinnamon_roll_mascot.png"
                    alt="The Rollecito cinnamon roll mascot"
                    className="h-72 w-72 sm:h-80 sm:w-80 object-contain"
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          FEATURED PRODUCTS
          ===================================================================== */}
      <section className="bg-[#FFF1DC]">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-dark">
              {t.favorites.title}
            </h2>
            <p className="mt-3 text-primary-dark/70 max-w-xl mx-auto">
              {t.favorites.subtitle}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.length > 0 ? (
              featured.map((item) => (
                <article
                  key={item.id}
                  className="group flex flex-col rounded-3xl bg-[#F2D6B3] p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-[#F4A261]/60 to-[#D98C5F]/50 flex items-center justify-center">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-6xl">🥐</span>
                    )}
                  </div>
                  <h3 className="mt-4 font-bold text-lg text-primary-dark line-clamp-1">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="mt-1 text-sm text-primary-dark/70 flex-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xl font-extrabold text-primary">
                      {formatCurrency(item.price)}
                    </span>
                    <Link
                      to="/order"
                      className="rounded-full bg-primary-dark px-4 py-2 text-xs font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
                    >
                      Order
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              // loading placeholders (preserves layout before API responds)
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-3xl bg-[#F2D6B3]/60"
                />
              ))
            )}
          </div>

          <div className="text-center mt-10">
            <Link to="/order">
              <Button variant="accent" size="lg">
                {t.favorites.viewFullMenu}
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          ABOUT
          ===================================================================== */}
      <section id="about" className="bg-[#FFF1DC]">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <div className="absolute inset-0 -m-4 rounded-[3rem] bg-[#F2D6B3]/70 rotate-3" />
              <div className="relative rounded-[3rem] bg-[#F4A261]/30 p-10 sm:p-14 shadow-[var(--shadow-warm)]">
                <img
                  src="/cinnamon_roll_mascot.png"
                  alt=""
                  aria-hidden="true"
                  className="mx-auto h-56 w-56 object-contain"
                  loading="lazy"
                />
              </div>
            </div>

            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-dark">
                {t.about.title}
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-primary-dark/80">
                {t.about.body}
              </p>

              <ul className="mt-8 space-y-3">
                {aboutPills.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-sm"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
                      <p.icon size={18} className="text-accent-hover" />
                    </span>
                    <span className="font-semibold text-primary-dark">{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* features strip */}
          <div className="mt-20 grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="text-center !bg-[#F2D6B3] !border-transparent"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/30">
                  <f.icon size={22} className="text-accent-hover" />
                </div>
                <h3 className="font-bold text-primary-dark">{f.title}</h3>
                <p className="mt-1 text-sm text-primary-dark/75">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          TESTIMONIALS
          ===================================================================== */}
      <section className="bg-[#F2D6B3]/50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-dark">
              {t.testimonials.title}
            </h2>
            <p className="mt-3 text-primary-dark/70">{t.testimonials.subtitle}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t_, idx) => (
              <figure
                key={idx}
                className="flex flex-col rounded-3xl bg-surface p-7 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
              >
                <div className="flex text-accent">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={16} className="fill-accent" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-primary-dark/85 leading-relaxed">
                  “{t_.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                    {t_.name.charAt(0)}
                  </span>
                  <span className="font-semibold text-primary-dark">{t_.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          CTA
          ===================================================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#A86A4A] to-[#4A3A35]" />
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-[#F4A261]/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#E76F51]/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#FFF1DC] leading-tight">
            {t.cta.title}
          </h2>
          <p className="mt-4 text-[#FFF1DC]/85 text-lg max-w-2xl mx-auto">
            {t.cta.subtitle}
          </p>
          <div className="mt-8">
            <Link to="/order">
              <Button variant="accent" size="lg" className="text-lg">
                {t.cta.startOrder}
                <ArrowRight size={20} />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
