import { describe, expect, it } from 'vitest';

process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? 'test-google-key';
process.env.GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID ?? 'test-cse-id';

import { sanitizeAddressForQuery } from '../src/addressSanitizer.js';
import {
  sanitizeCompanyNameForQuery,
  sanitizeLicenseNumberForQuery,
} from '../src/companySanitizer.js';

describe('sanitizeAddressForQuery', () => {
  it('normalizes japanese address components into ASCII hyphenated form', () => {
    const rawAddress = '愛知県名古屋市中区錦１丁目１７番１３号２Ｆ';

    const sanitized = sanitizeAddressForQuery(rawAddress);

    expect(sanitized).toBe('愛知県名古屋市中区錦1-17-13-2F');
  });

  it('removes the room designator without inserting spurious hyphens', () => {
    const rawAddress = '京都中野区中央５丁目３８－１３エスエス１０－４０２号室';

    const sanitized = sanitizeAddressForQuery(rawAddress);

    expect(sanitized).toBe('京都中野区中央5-38-13エスエス10-402');
  });

  it('removes building names appended after the block number', () => {
    const rawAddress = '東京都渋谷区神宮前６丁目２３番４号桑野ビル２Ｆ';

    const sanitized = sanitizeAddressForQuery(rawAddress);

    expect(sanitized).toBe('東京都渋谷区神宮前6-23-4');
  });
});

describe('sanitizeCompanyNameForQuery', () => {
  it('converts full-width alphanumerics to half-width characters', () => {
    const rawCompanyName = '株式会社ＡＢＣ１２３';

    const sanitized = sanitizeCompanyNameForQuery(rawCompanyName);

    expect(sanitized).toBe('株式会社ABC123');
  });

  it('preserves japanese characters while normalizing whitespace', () => {
    const rawCompanyName = 'ＡＩ株式会社　テスト部門';

    const sanitized = sanitizeCompanyNameForQuery(rawCompanyName);

    expect(sanitized).toBe('AI株式会社 テスト部門');
  });
});

describe('sanitizeLicenseNumberForQuery', () => {
  it('normalizes full-width digits and dashes', () => {
    const rawLicenseNumber = '１３－ユ－１２３４５６';

    const sanitized = sanitizeLicenseNumberForQuery(rawLicenseNumber);

    expect(sanitized).toBe('13-ユ-123456');
  });

  it('collapses extra whitespace', () => {
    const rawLicenseNumber = ' 13-ユ-123456   ';

    const sanitized = sanitizeLicenseNumberForQuery(rawLicenseNumber);

    expect(sanitized).toBe('13-ユ-123456');
  });
});
