'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { translations, defaultLang, type Lang, type Translations } from '@/lib/i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: Translations;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Default on server + first client render (SSR-safe); hydrate after mount.
  const [lang, setLangState] = useState<Lang>(defaultLang);

  useEffect(() => {
    const saved = window.localStorage.getItem('lang');
    if (saved && saved in translations) {
      setLangState(saved as Lang);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    window.localStorage.setItem('lang', newLang);
    document.documentElement.lang = newLang;
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === 'en' ? 'es' : 'en');
  }, [lang, setLang]);

  const t = useMemo(() => translations[lang], [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, toggle, t }}>{children}</LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
