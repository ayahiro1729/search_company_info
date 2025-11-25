import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

import type { CompanyInfo, ScoreResult } from '../src/types.js';

process.env.SCRAPINGDOG_API_KEY =
  process.env.SCRAPINGDOG_API_KEY ?? 'test-scrapingdog-key';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? 'test-google-key';
process.env.GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID ?? 'test-cse-id';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'test-gemini-key';
process.env.BRAVE_API_KEY = process.env.BRAVE_API_KEY ?? 'test-brave-key';

const fetchMock = vi.fn();

vi.mock('../src/scrapingdogSearch.js', () => ({
  searchCompanyWebsites: vi.fn(),
}));

vi.mock('../src/googleSearch.js', () => ({
  searchCompanyWebsites: vi.fn(),
}));

vi.mock('../src/braveSearch.js', () => ({
  searchCompanyWebsites: vi.fn(),
}));

vi.mock('../src/geminiScorer.js', () => ({
  scoreCandidateUrls: vi.fn(),
}));

const { searchCompanyWebsites: scrapingdogSearchCompanyWebsites } =
  await import('../src/scrapingdogSearch.js');
const { searchCompanyWebsites: googleSearchCompanyWebsites } = await import(
  '../src/googleSearch.js'
);
const { searchCompanyWebsites: braveSearchCompanyWebsites } = await import(
  '../src/braveSearch.js'
);
const { scoreCandidateUrls } = await import('../src/geminiScorer.js');
const { findBestCompanyUrl } = await import('../src/index.js');

describe('findBestCompanyUrl', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        'Sample content mentioning Acme Corp and address 123 Street',
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    (
      scrapingdogSearchCompanyWebsites as MockedFunction<
        typeof scrapingdogSearchCompanyWebsites
      >
    ).mockReset();
    (googleSearchCompanyWebsites as MockedFunction<
      typeof googleSearchCompanyWebsites
    >).mockReset();
    (braveSearchCompanyWebsites as MockedFunction<
      typeof braveSearchCompanyWebsites
    >).mockReset();
    (
      scoreCandidateUrls as MockedFunction<typeof scoreCandidateUrls>
    ).mockReset();
  });

  it('returns the highest scoring URL from Scrapingdog results when the score is above the threshold', async () => {
    const company: CompanyInfo = {
      name: 'Acme Corp',
      licenseNumber: '13-ユ-123456',
      licenseAddress: '123 Street',
    };

    (
      scrapingdogSearchCompanyWebsites as MockedFunction<
        typeof scrapingdogSearchCompanyWebsites
      >
    ).mockResolvedValue([
      {
        title: 'Acme Corp - Official',
        url: 'https://www.acme.com',
        snippet: 'Official website for Acme Corp',
      },
      {
        title: 'Acme Partners',
        url: 'https://partners.acme.com',
        snippet: 'Partners portal',
      },
    ]);

    const scores: ScoreResult = {
      urls: [
        { url: 'https://www.acme.com', score: 0.9, reason: 'Official domain' },
        {
          url: 'https://partners.acme.com',
          score: 0.6,
          reason: 'Partner portal',
        },
      ],
      headquartersAddress: '123 HQ Street',
    };

    (
      scoreCandidateUrls as MockedFunction<typeof scoreCandidateUrls>
    ).mockResolvedValue(scores);

    const result = await findBestCompanyUrl(company);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      ...scores.urls[0],
      url: 'https://www.acme.com/',
      headquartersAddress: '123 HQ Street',
    });
    expect(
      googleSearchCompanyWebsites as MockedFunction<
        typeof googleSearchCompanyWebsites
      >
    ).not.toHaveBeenCalled();
  });

  it('normalizes the best URL to the domain when Gemini returns a path', async () => {
    const company: CompanyInfo = {
      name: 'Acme Corp',
      licenseNumber: '13-ユ-123456',
      licenseAddress: '123 Street',
    };

    (
      scrapingdogSearchCompanyWebsites as MockedFunction<
        typeof scrapingdogSearchCompanyWebsites
      >
    ).mockResolvedValue([
      {
        title: 'Acme Corp - Official',
        url: 'https://www.acme.com/company',
        snippet: 'Official website for Acme Corp',
      },
    ]);

    const scores: ScoreResult = {
      urls: [
        {
          url: 'https://www.acme.com/company',
          score: 0.95,
          reason: 'Likely official page',
        },
      ],
      headquartersAddress: '123 HQ Street',
    };

    (
      scoreCandidateUrls as MockedFunction<typeof scoreCandidateUrls>
    ).mockResolvedValue(scores);

    const result = await findBestCompanyUrl(company);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ...scores.urls[0],
      url: 'https://www.acme.com/',
      headquartersAddress: '123 HQ Street',
    });
  });

  it('returns undefined when there are no Scrapingdog results', async () => {
    const company: CompanyInfo = {
      name: 'Unknown Inc',
      licenseNumber: '99-ユ-999999',
    };
    (
      scrapingdogSearchCompanyWebsites as MockedFunction<
        typeof scrapingdogSearchCompanyWebsites
      >
    ).mockResolvedValue([]);

    const result = await findBestCompanyUrl(company);

    expect(result).toBeUndefined();
    expect(scoreCandidateUrls).not.toHaveBeenCalled();
  });

  it('falls back through Google and Brave when earlier providers score too low', async () => {
    const company: CompanyInfo = {
      name: 'Fallback Corp',
      licenseNumber: '01-ユ-000001',
    };

    (
      scrapingdogSearchCompanyWebsites as MockedFunction<
        typeof scrapingdogSearchCompanyWebsites
      >
    ).mockResolvedValue([
      {
        title: 'Fallback Corp Blog',
        url: 'https://blog.fallback.example',
        snippet: 'Blog mentioning Fallback Corp',
      },
    ]);

    (
      googleSearchCompanyWebsites as MockedFunction<
        typeof googleSearchCompanyWebsites
      >
    ).mockResolvedValue([
      {
        title: 'Fallback Corp Directory Entry',
        url: 'https://directory.fallback.example',
        snippet: 'Directory entry',
      },
    ]);

    (
      braveSearchCompanyWebsites as MockedFunction<
        typeof braveSearchCompanyWebsites
      >
    ).mockResolvedValue([
      {
        title: 'Fallback Corp Official',
        url: 'https://www.fallback.example/about',
        snippet: 'Official info',
      },
    ]);

    (
      scoreCandidateUrls as MockedFunction<typeof scoreCandidateUrls>
    )
      .mockResolvedValueOnce({
        urls: [
          {
            url: 'https://blog.fallback.example',
            score: 0.6,
            reason: 'Blog reference',
          },
        ],
      })
      .mockResolvedValueOnce({
        urls: [
          {
            url: 'https://directory.fallback.example',
            score: 0.65,
            reason: 'Directory listing',
          },
        ],
      })
      .mockResolvedValueOnce({
        urls: [
          {
            url: 'https://www.fallback.example/about',
            score: 0.82,
            reason: 'Official site',
          },
        ],
        headquartersAddress: 'Fallback HQ Address',
      });

    const result = await findBestCompanyUrl(company);

    expect(result).toEqual({
      url: 'https://www.fallback.example/',
      score: 0.82,
      reason: 'Official site',
      headquartersAddress: 'Fallback HQ Address',
    });
    expect(
      scrapingdogSearchCompanyWebsites as MockedFunction<
        typeof scrapingdogSearchCompanyWebsites
      >
    ).toHaveBeenCalledTimes(1);
    expect(
      googleSearchCompanyWebsites as MockedFunction<
        typeof googleSearchCompanyWebsites
      >
    ).toHaveBeenCalledTimes(1);
    expect(
      braveSearchCompanyWebsites as MockedFunction<
        typeof braveSearchCompanyWebsites
      >
    ).toHaveBeenCalledTimes(1);
    expect(scoreCandidateUrls).toHaveBeenCalledTimes(3);
  });
});
