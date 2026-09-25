import en from './en';
import es from './es';

export const translations = { en, es };
export const defaultLang = 'en' as const;
export const supportedLangs = ['en', 'es'] as const;

export type Lang = (typeof supportedLangs)[number];
/** Shape of a translation bundle (derived from the English source of truth). */
export type Translations = typeof en;

/** Fill `{name}`-style placeholders: fmt('{n} items', { n: 3 }) → '3 items'. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
