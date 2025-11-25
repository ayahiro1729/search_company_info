import { customsearch_v1 } from '@googleapis/customsearch';

import { sanitizeAddressForQuery } from './addressSanitizer.js';
import {
  sanitizeCompanyNameForQuery,
  sanitizeLicenseNumberForQuery,
} from './companySanitizer.js';
import { appConfig } from './config.js';
import { logger } from './logger.js';
import { CompanyInfo, SearchResultItem } from './types.js';

const customSearchClient = new customsearch_v1.Customsearch({});

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
  logger.info(`Searching for company websites with query: ${query}`);

  try {
    const response = await customSearchClient.cse.list({
      auth: appConfig.googleApiKey,
      cx: appConfig.googleSearchEngineId,
      q: query,
      num: appConfig.googleSearchResultCount,
      hl: 'ja',
      lr: 'lang_ja',
      gl: 'jp',
      filter: '1',
    });

    const items = response.data.items ?? [];
    logger.debug(`Received ${items.length} search results.`);

    const normalizedResults = items
      .filter((item): item is customsearch_v1.Schema$Result =>
        Boolean(item.link)
      )
      .map((item) => ({
        title: item.title ?? item.link ?? 'Untitled result',
        url: item.link as string,
        snippet: item.snippet ?? item.htmlSnippet ?? undefined,
      }));

    logger.info(
      `Google Custom Search results: ${JSON.stringify(normalizedResults)}`
    );

    return normalizedResults;
  } catch (error) {
    logger.error('Failed to execute Google Custom Search request.', error);
    throw error;
  }
}
