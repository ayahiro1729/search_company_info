import { fileURLToPath } from 'node:url';

import { searchCompanyWebsites as searchBraveCompanyWebsites } from './braveSearch.js';
import { appConfig } from './config.js';
import { scoreCandidateUrls } from './geminiScorer.js';
import { searchCompanyWebsites as searchGoogleCompanyWebsites } from './googleSearch.js';
import { logger } from './logger.js';
import { searchCompanyWebsites as searchScrapingdogCompanyWebsites } from './scrapingdogSearch.js';
import {
  CompanyInfo,
  CompanySearchResult,
  PageContent,
  ScoredUrl,
  SearchResultItem,
} from './types.js';
import { getDomainUrl } from './urlSanitizer.js';

const GEMINI_CONFIDENCE_THRESHOLD = 0.7;

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      logger.warn(
        `Failed to fetch page content for ${url}. Status: ${response.status}`
      );
      return '';
    }
    const content = await response.text();
    return content;
  } catch (error) {
    logger.warn(`Error fetching content for ${url}`, error);
    return '';
  }
}

export async function findBestCompanyUrl(
  company: CompanyInfo
): Promise<CompanySearchResult | undefined> {
  logger.info(`Starting workflow for ${company.name}`);

  const evaluateSearchResults = async (
    providerName: string,
    searchFn: (company: CompanyInfo) => Promise<SearchResultItem[]>
  ): Promise<{ best?: ScoredUrl; headquartersAddress?: string }> => {
    const searchResults = await searchFn(company);
    const normalizedResults = Array.isArray(searchResults)
      ? searchResults
      : [];
    if (normalizedResults.length === 0) {
      logger.warn(`${providerName} search returned no results.`);
      return { best: undefined };
    }

    const pages: PageContent[] = await Promise.all(
      normalizedResults.map(async (result) => ({
        ...result,
        content: await fetchPageContent(result.url),
      }))
    );

    const { urls: scored, headquartersAddress } = await scoreCandidateUrls(
      company,
      pages
    );
    if (scored.length === 0) {
      logger.warn(`${providerName} search results could not be scored.`);
      return { best: undefined, headquartersAddress };
    }

    const best = [...scored].sort((a, b) => b.score - a.score)[0];
    return {
      best: { ...best, url: getDomainUrl(best.url) },
      headquartersAddress,
    };
  };

  const searchPipeline: Array<{
    name: string;
    searchFn: (company: CompanyInfo) => Promise<SearchResultItem[]>;
  }> = [
    { name: 'Scrapingdog', searchFn: searchScrapingdogCompanyWebsites },
    { name: 'Google', searchFn: searchGoogleCompanyWebsites },
    { name: 'Brave', searchFn: searchBraveCompanyWebsites },
  ];

  let bestResult: ScoredUrl | undefined;
  let bestProvider: string | undefined;
  let headquartersAddress: string | undefined;

  for (const provider of searchPipeline) {
    const { best: result, headquartersAddress: detectedAddress } =
      await evaluateSearchResults(provider.name, provider.searchFn);

    if (!result) {
      logger.info(
        `${provider.name} search produced no scorer-friendly candidates.`
      );
      continue;
    }

    const isBetter = !bestResult || result.score > bestResult.score;
    if (isBetter) {
      bestResult = result;
      bestProvider = provider.name;
      headquartersAddress = detectedAddress;
    } else if (!headquartersAddress && detectedAddress) {
      headquartersAddress = detectedAddress;
    }

    if (result.score > GEMINI_CONFIDENCE_THRESHOLD) {
      break;
    }

    logger.info(
      `Best ${provider.name} score (${result.score.toFixed(
        2
      )}) is at or below ${GEMINI_CONFIDENCE_THRESHOLD.toFixed(
        2
      )}. Trying next provider.`
    );
  }

  if (!bestResult) {
    logger.warn('No suitable website found after checking all providers.');
    return undefined;
  }

  logger.info(
    `Best URL for ${company.name}: ${bestResult.url} (score=${bestResult.score.toFixed(
      2
    )}, provider=${bestProvider ?? 'unknown'})`
  );
  return { ...bestResult, headquartersAddress };
}

function parseArgs(argv: string[]): CompanyInfo {
  const args = argv.slice(2);
  const company: CompanyInfo = { name: '', licenseNumber: '' };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--name' && args[i + 1]) {
      company.name = args[i + 1];
      i += 1;
    } else if (arg === '--license-number' && args[i + 1]) {
      company.licenseNumber = args[i + 1];
      i += 1;
    } else if (arg === '--license-address' && args[i + 1]) {
      company.licenseAddress = args[i + 1];
      i += 1;
    } else if (arg === '--description' && args[i + 1]) {
      company.description = args[i + 1];
      i += 1;
    }
  }

  if (!company.name) {
    throw new Error(
      'Company name is required. Use --name "Company Name" to provide it.'
    );
  }

  if (!company.licenseNumber) {
    throw new Error(
      'License number is required. Use --license-number "XX-YYYYYYY" to provide it.'
    );
  }

  return company;
}

async function runFromCli(): Promise<void> {
  try {
    const company = parseArgs(process.argv);
    const best = await findBestCompanyUrl(company);
    if (best) {
      console.log(JSON.stringify(best, null, 2));
    } else {
      console.log('No suitable website found.');
    }
  } catch (error) {
    logger.error('CLI execution failed.', error);
    process.exitCode = 1;
  }
}

const isExecutedDirectly = process.argv[1] === fileURLToPath(import.meta.url);

if (isExecutedDirectly) {
  runFromCli().catch((error) => {
    logger.error('Unexpected error running CLI.', error);
    process.exitCode = 1;
  });
}

export { appConfig };
