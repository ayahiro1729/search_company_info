import { sanitizeAddressForQuery } from './addressSanitizer.js';
import {
  sanitizeCompanyNameForQuery,
  sanitizeLicenseNumberForQuery,
} from './companySanitizer.js';
import { appConfig } from './config.js';
import { logger } from './logger.js';
import { CompanyInfo, SearchResultItem } from './types.js';

const SCRAPINGDOG_SEARCH_ENDPOINT = 'https://api.scrapingdog.com/google';

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
  logger.info(`Searching Scrapingdog (Google SERP) with query: ${query}`);

  const url = new URL(SCRAPINGDOG_SEARCH_ENDPOINT);
  url.searchParams.set('api_key', appConfig.scrapingdogApiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('gl', 'jp');
  url.searchParams.set('hl', 'ja');
  url.searchParams.set('num', String(appConfig.scrapingdogSearchResultCount));
  url.searchParams.set('device', 'desktop');

  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.error(
        `Scrapingdog request failed with status ${response.status}: ${response.statusText}`
      );
      return [];
    }

    const payload = (await response.json()) as {
      organic_results?: Array<{
        link?: string;
        title?: string;
        snippet?: string;
        description?: string;
      }>;
    };

    const results = payload.organic_results ?? [];
    logger.debug(`Received ${results.length} Scrapingdog results.`);

    const normalized: SearchResultItem[] = results
      .filter((item) => typeof item.link === 'string')
      .map((item) => ({
        title: item.title ?? (item.link as string),
        url: item.link as string,
        snippet: item.snippet ?? item.description ?? undefined,
      }));

    logger.info(`Scrapingdog search results: ${JSON.stringify(normalized)}`);
    return normalized;
  } catch (error) {
    logger.error('Failed to execute Scrapingdog request.', error);
    return [];
  }
}
