import { describe, expect, it } from 'vitest';

import { getDomainUrl } from '../src/urlSanitizer.js';

describe('getDomainUrl', () => {
  it('returns the origin with trailing slash for https urls', () => {
    expect(getDomainUrl('https://www.example.com/path/page')).toBe(
      'https://www.example.com/'
    );
  });

  it('adds protocol when missing', () => {
    expect(getDomainUrl('example.com/path')).toBe('https://example.com/');
  });

  it('returns empty string for falsy input', () => {
    expect(getDomainUrl('')).toBe('');
  });

  it('returns trimmed input when url parsing fails', () => {
    expect(getDomainUrl('not a url')).toBe('not a url');
  });
});
