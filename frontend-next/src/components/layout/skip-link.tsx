/**
 * "Skip to main content" (WCAG 2.4.1 Bypass Blocks). Invisible until it
 * receives keyboard focus, so the visual design is unchanged for everyone
 * else. Targets the <main id="main-content" tabIndex={-1}> in each layout.
 */
export default function SkipLink({ label = 'Skip to main content' }: { label?: string }) {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-dark focus:shadow-[var(--shadow-elevated)]"
    >
      {label}
    </a>
  );
}
