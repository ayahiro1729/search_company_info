import { sanitizeAddressForQuery } from './addressSanitizer.js';
import {
  sanitizeCompanyNameForQuery,
  sanitizeLicenseNumberForQuery,
} from './companySanitizer.js';
import { appConfig } from './config.js';
import { logger } from './logger.js';
import { CompanyInfo, SearchResultItem } from './types.js';

const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

export async function searchCompanyWebsites(
  company: CompanyInfo
): Promise<SearchResultItem[]> {
  const sanitizedCompanyName = sanitizeCompanyNameForQuery(company.name);
  const sanitizedLicenseNumber = sanitizeLicenseNumberForQuery(
    company.licenseNumber
  );
  const queryParts = [
    sanitizedCompanyName,
    '有料職業紹介',
    sanitizedLicenseNumber,
    '会社概要',
  ];

  if (company.licenseAddress) {
    const sanitizedAddress = sanitizeAddressForQuery(company.licenseAddress);
    if (sanitizedAddress.length > 0) {
      queryParts.push(sanitizedAddress, '本社');
    }
  }

  const query = queryParts.join(' ');
  logger.info(`Searching Brave for company websites with query: ${query}`);

  const url = new URL(BRAVE_SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(appConfig.braveSearchResultCount));

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': appConfig.braveApiKey,
      },
    });

    if (!response.ok) {
      logger.error(
        `Brave Search request failed with status ${response.status}: ${response.statusText}`
      );
      return [];
    }

    const payload = (await response.json()) as {
      web?: { results?: Array<{ url?: string; title?: string; description?: string }> };
    };

    const results = payload.web?.results ?? [];
    logger.debug(`Received ${results.length} Brave search results.`);

    const normalized: SearchResultItem[] = results
      .filter((item) => typeof item.url === 'string')
      .map((item) => ({
        title: item.title ?? (item.url as string),
        url: item.url as string,
        snippet: item.description ?? undefined,
      }));

    logger.info(`Brave Search results: ${JSON.stringify(normalized)}`);
    return normalized;
  } catch (error) {
    logger.error('Failed to execute Brave Search request.', error);
    return [];
  }
}
