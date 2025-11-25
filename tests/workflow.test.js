import { beforeEach, describe, expect, it, vi } from 'vitest';
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
const { searchCompanyWebsites: scrapingdogSearchCompanyWebsites } = await import('../src/scrapingdogSearch.js');
const { searchCompanyWebsites: googleSearchCompanyWebsites } = await import('../src/googleSearch.js');
const { searchCompanyWebsites: braveSearchCompanyWebsites } = await import('../src/braveSearch.js');
const { scoreCandidateUrls } = await import('../src/geminiScorer.js');
const { findBestCompanyUrl } = await import('../src/index.js');
describe('findBestCompanyUrl', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({
            ok: true,
            text: async () => 'Sample content mentioning Acme Corp and address 123 Street',
        });
        global.fetch = fetchMock;
        scrapingdogSearchCompanyWebsites.mockReset();
        googleSearchCompanyWebsites.mockReset();
        braveSearchCompanyWebsites.mockReset();
        scoreCandidateUrls.mockReset();
    });
    it('returns the highest scoring URL from Scrapingdog results when the score is above the threshold', async () => {
        const company = {
            name: 'Acme Corp',
            licenseNumber: '13-ユ-123456',
            licenseAddress: '123 Street',
        };
        scrapingdogSearchCompanyWebsites.mockResolvedValue([
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
        scoreCandidateUrls.mockResolvedValue({
            urls: [
                { url: 'https://www.acme.com', score: 0.9, reason: 'Official domain' },
                {
                    url: 'https://partners.acme.com',
                    score: 0.6,
                    reason: 'Partner portal',
                },
            ],
            headquartersAddress: '123 HQ Street',
        });
        const result = await findBestCompanyUrl(company);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
            url: 'https://www.acme.com/',
            score: 0.9,
            reason: 'Official domain',
            headquartersAddress: '123 HQ Street',
        });
        expect(googleSearchCompanyWebsites).not.toHaveBeenCalled();
        expect(braveSearchCompanyWebsites).not.toHaveBeenCalled();
    });
    it('returns undefined when there are no Scrapingdog results', async () => {
        const company = { name: 'Unknown Inc', licenseNumber: '99-ユ-999999' };
        scrapingdogSearchCompanyWebsites.mockResolvedValue([]);
        const result = await findBestCompanyUrl(company);
        expect(result).toBeUndefined();
        expect(scoreCandidateUrls).not.toHaveBeenCalled();
    });
});
