import { I18nService } from './i18n.service.js';

describe('I18nService', () => {
  let service: I18nService;

  beforeAll(async () => {
    service = new I18nService();
    await service.onModuleInit();
  });

  describe('resolveLocale', () => {
    it('passes through a supported locale', () => {
      expect(service.resolveLocale('en')).toBe('en');
      expect(service.resolveLocale('hu')).toBe('hu');
    });

    it('falls back to hu for an unsupported/missing locale', () => {
      expect(service.resolveLocale('de')).toBe('hu');
      expect(service.resolveLocale(undefined)).toBe('hu');
    });
  });

  describe('t', () => {
    it('translates a known key in Hungarian', () => {
      expect(service.t('email.common.labelEventType', 'hu')).toBe('Esemény');
    });

    it('translates the same key in English', () => {
      expect(service.t('email.common.labelEventType', 'en')).toBe('Event');
    });

    it('interpolates variables into the translation', () => {
      const result = service.t('email.bookingConfirmed.client.subject', 'hu', {
        title: 'Kezdő konzultáció',
      });
      expect(result).toContain('Kezdő konzultáció');
    });

    it('falls back to Hungarian for an unsupported locale', () => {
      const hu = service.t('email.common.labelEventType', 'hu');
      const fallback = service.t('email.common.labelEventType', 'fr');
      expect(fallback).toBe(hu);
    });
  });
});
