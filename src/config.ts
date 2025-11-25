import { config as loadEnv } from 'dotenv';

loadEnv();

export interface AppConfig {
  googleApiKey: string;
  googleSearchEngineId: string;
  geminiApiKey: string;
  googleSearchResultCount: number;
  geminiModel: string;
  braveApiKey: string;
  braveSearchResultCount: number;
  scrapingdogApiKey: string;
  scrapingdogSearchResultCount: number;
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number when provided.`);
  }

  return parsed;
}

export const appConfig: AppConfig = {
  googleApiKey: getEnvVar('GOOGLE_API_KEY'),
  googleSearchEngineId: getEnvVar('GOOGLE_CSE_ID'),
  geminiApiKey: getEnvVar('GEMINI_API_KEY'),
  googleSearchResultCount: parseNumber('GOOGLE_SEARCH_RESULT_COUNT', 10),
  geminiModel: process.env.GEMINI_MODEL ?? 'models/gemini-1.5-pro-latest',
  braveApiKey: getEnvVar('BRAVE_API_KEY'),
  braveSearchResultCount: parseNumber('BRAVE_SEARCH_RESULT_COUNT', 10),
  scrapingdogApiKey: getEnvVar('SCRAPINGDOG_API_KEY'),
  scrapingdogSearchResultCount: parseNumber('SCRAPINGDOG_SEARCH_RESULT_COUNT', 10),
};
