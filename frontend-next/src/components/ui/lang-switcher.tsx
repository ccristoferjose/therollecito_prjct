'use client';

import { useLang } from '@/providers/lang-provider';
import { cn } from '@/lib/utils/cn';

export default function LangSwitcher({ className }: { className?: string }) {
  const { toggle, t, lang } = useLang();
  // The label names the OTHER language, in that language ("Español" on the
  // English site), so it carries that language's code (WCAG 3.1.2).
  const targetLang = lang === 'en' ? 'es' : 'en';

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 transition-colors',
        className,
      )}
      title={t.lang.switchTo}
      lang={targetLang}
    >
      {/* The flag is decoration; on phones the text is visually hidden but
          still names the button, so it is never announced as just a flag. */}
      <span aria-hidden="true">{t.lang.flag}</span>
      <span className="sr-only sm:not-sr-only">{t.lang.switchTo}</span>
    </button>
  );
}
