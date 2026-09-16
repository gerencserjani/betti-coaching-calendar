import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, OnModuleInit } from '@nestjs/common';
import i18next, { type i18n } from 'i18next';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Locale = 'hu' | 'en';
export const SUPPORTED_LOCALES: Locale[] = ['hu', 'en'];
export const DEFAULT_LOCALE: Locale = 'hu';

function loadLocale(locale: Locale): Record<string, string> {
  const raw = readFileSync(
    join(__dirname, 'locales', `${locale}.json`),
    'utf-8',
  );
  return JSON.parse(raw) as Record<string, string>;
}

@Injectable()
export class I18nService implements OnModuleInit {
  private instance!: i18n;

  async onModuleInit() {
    this.instance = i18next.createInstance();
    await this.instance.init({
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      resources: {
        hu: { translation: loadLocale('hu') },
        en: { translation: loadLocale('en') },
      },
    });
  }

  t(
    key: string,
    locale: string | undefined,
    vars?: Record<string, string | number>,
  ): string {
    const resolvedLocale = this.resolveLocale(locale);
    return this.instance.getFixedT(resolvedLocale)(key, vars);
  }

  resolveLocale(locale: string | undefined): Locale {
    return SUPPORTED_LOCALES.includes(locale as Locale)
      ? (locale as Locale)
      : DEFAULT_LOCALE;
  }
}
