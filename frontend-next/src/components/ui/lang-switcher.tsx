'use client';

import { useLang } from '@/providers/lang-provider';
import { cn } from '@/lib/utils/cn';

export default function LangSwitcher({ className }: { className?: string }) {
  const { toggle, t } = useLang();

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 transition-colors',
        className,
      )}
      title={t.lang.switchTo}
    >
      <span>{t.lang.flag}</span>
      <span className="hidden sm:inline">{t.lang.switchTo}</span>
    </button>
  );
}
