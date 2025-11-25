import { GoogleGenAI } from '@google/genai';

import { appConfig } from './config.js';
import { logger } from './logger.js';
import {
  CompanyInfo,
  GeminiScoreResponse,
  PageContent,
  ScoredUrl,
  ScoreResult,
} from './types.js';
import { getDomainUrl } from './urlSanitizer.js';

const geminiClient = new GoogleGenAI({ apiKey: appConfig.geminiApiKey });

function extractTextFromGeminiResponse(response: unknown): string {
  if (!response) {
    return '';
  }

  const collected: string[] = [];
  const payload = response as Record<string, unknown>;

  const candidateGroups = [
    (payload.response as { candidates?: unknown[] } | undefined)?.candidates,
    (payload as { candidates?: unknown[] }).candidates,
    (payload.output as { candidates?: unknown[] } | undefined)?.candidates,
    (payload.result as { candidates?: unknown[] } | undefined)?.candidates,
  ].filter((group): group is unknown[] => Array.isArray(group));

  const extractFromParts = (parts: unknown): string[] => {
    if (!Array.isArray(parts)) {
      return [];
    }

    return parts
      .map((part) => {
        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof (part as { text: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }

        if (typeof part === 'string') {
          return part;
        }

        return '';
      })
      .filter((text): text is string => Boolean(text?.trim?.()));
  };

  for (const candidates of candidateGroups) {
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }

      const candidateObj = candidate as {
        content?: { parts?: unknown[] } | undefined;
        parts?: unknown[];
        output_text?: string;
      };

      collected.push(...extractFromParts(candidateObj.content?.parts));
      collected.push(...extractFromParts(candidateObj.parts));

      if (
        typeof candidateObj.output_text === 'string' &&
        candidateObj.output_text.trim().length > 0
      ) {
        collected.push(candidateObj.output_text);
      }
    }
  }

  const outputArray =
    (payload.output as unknown[])?.filter?.(
      (item) => item && typeof item === 'object'
    ) ?? [];
  if (Array.isArray(outputArray)) {
    for (const item of outputArray) {
      const entry = item as {
        content?: { parts?: unknown[] };
        parts?: unknown[];
        output_text?: string;
      };
      collected.push(...extractFromParts(entry.content?.parts));
      collected.push(...extractFromParts(entry.parts));
      if (
        typeof entry.output_text === 'string' &&
        entry.output_text.trim().length > 0
      ) {
        collected.push(entry.output_text);
      }
    }
  }

  const textLikeCandidates = [
    (payload.response as { text?: () => string } | undefined)?.text?.() ?? '',
    (payload.response as { output_text?: string } | undefined)?.output_text ??
      '',
    (payload as { output_text?: string }).output_text ?? '',
    (payload as { text?: string }).text ?? '',
  ].filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  );

  collected.push(...textLikeCandidates);

  const uniqueText = collected
    .map((text) => text.trim())
    .filter(
      (text, index, array) => text.length > 0 && array.indexOf(text) === index
    );

  if (uniqueText.length === 0) {
    return '';
  }

  return uniqueText.join('\n');
}

function buildPrompt(company: CompanyInfo, pages: PageContent[]): string {
  const pageSummaries = pages
    .map(
      (page) =>
        `URL: ${page.url}\nTitle: ${page.title}\nSnippet: ${
          page.snippet ?? 'N/A'
        }\nContent Preview: ${page.content.slice(0, 1000)}`
    )
    .join('\n---\n');

  const description = company.description
    ? `Description: ${company.description}`
    : 'Description: Not provided';
  const licenseAddress = company.licenseAddress
    ? `License address: ${company.licenseAddress}`
    : 'License address: Not provided';

  return (
    `You are evaluating candidate company websites to identify the OFFICIAL CORPORATE WEBSITE and confirm the headquarters address. Return ONLY a raw JSON object (no markdown, no code blocks, no backticks).\n\n` +
    `The JSON must have the following properties:\n` +
    `"urls": an array of objects shaped like {"url": string, "score": number between 0 and 1, "reason": string}\n` +
    `"headquarters_address": string | null (the best headquarters/main office address you can find from the candidate pages)\n\n` +
    `Company name: ${company.name}\n` +
    `Paid Employment Placement license number: ${company.licenseNumber}\n` +
    `${licenseAddress}\n${description}\n\nCandidate pages:\n${pageSummaries}\n\n` +
    `SCORING CRITERIA (be strict):\n` +
    `• 0.0-0.2: Clearly NOT the official website (social media, job boards, news articles, Wikipedia, review sites, etc.)\n` +
    `• 0.3-0.5: Related to the company but likely not the official corporate site (press releases, third-party listings)\n` +
    `• 0.6-0.8: Possibly the official website but with some uncertainty\n` +
    `• 0.9-1.0: Almost certainly the official corporate website\n\n` +
    `SITES TO SCORE LOW (0.0-0.3):\n` +
    `- Social media: Twitter/X, Facebook, LinkedIn, Instagram, YouTube channels\n` +
    `- Job boards: Indeed, Rikunabi, Wantedly, Green, recruitment portals\n` +
    `- News/Media: News articles, press releases on news sites, blog posts about the company\n` +
    `- Information aggregators: Wikipedia, company databases, review sites, rating sites\n` +
    `- E-commerce platforms: Amazon, Rakuten, Yahoo Shopping stores\n\n` +
    `OFFICIAL WEBSITE INDICATORS (score high):\n` +
    `- Domain name closely matches company name\n` +
    `- Contains company information matching the provided license number/address/description\n` +
    `- Corporate structure (About Us, Services, Contact pages)\n` +
    `- Self-hosted content, not on third-party platforms\n\n` +
    `HEADQUARTERS ADDRESS: Prefer the official headquarters/main office address from the company's own site. If multiple addresses exist, choose the headquarters/head office. If none are found, return null.\n\n` +
    `EVALUATE: Domain relevance, content ownership, site type, company info accuracy, and alignment with the provided license info. Always return scores for every provided URL. Return ONLY the JSON object, nothing else.`
  );
}

function stripPostalCode(text: string): string {
  return text.replace(/〒?\d{3}-\d{4}\s*/g, '').trim();
}

function normalizeAddress(candidate?: string | null): string | undefined {
  const trimmed = candidate?.trim();
  if (!trimmed) {
    return undefined;
  }
  return stripPostalCode(trimmed);
}

function safeParseGeminiResponse(raw: string): GeminiScoreResponse | undefined {
  try {
    // トリムして余分な空白を削除
    let cleanedJson = raw.trim();

    // 念のため、マークダウンコードブロックがあれば削除（フォールバック）
    const codeBlockMatch = cleanedJson.match(
      /^```(?:json)?\s*([\s\S]*?)\s*```$/
    );
    if (codeBlockMatch) {
      cleanedJson = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(cleanedJson) as GeminiScoreResponse & {
      headquarters_address?: string | null;
    };
    if (!parsed || !Array.isArray(parsed.urls)) {
      return undefined;
    }
    const headquartersAddress =
      normalizeAddress(parsed.headquartersAddress) ??
      normalizeAddress(parsed.headquarters_address);
    return {
      urls: parsed.urls
        .filter(
          (entry) =>
            typeof entry.url === 'string' && typeof entry.score === 'number'
        )
        .map((entry) => ({
          url: getDomainUrl(entry.url),
          score: Math.min(1, Math.max(0, entry.score)),
          reason: entry.reason,
        })),
      headquartersAddress,
    };
  } catch (error) {
    logger.warn('Unable to parse Gemini response as JSON.', error);
    return undefined;
  }
}

function extractHeadquartersAddressFromPages(
  pages: PageContent[]
): string | undefined {
  const prefectures = [
    '北海道',
    '青森県',
    '岩手県',
    '宮城県',
    '秋田県',
    '山形県',
    '福島県',
    '茨城県',
    '栃木県',
    '群馬県',
    '埼玉県',
    '千葉県',
    '東京都',
    '神奈川県',
    '新潟県',
    '富山県',
    '石川県',
    '福井県',
    '山梨県',
    '長野県',
    '岐阜県',
    '静岡県',
    '愛知県',
    '三重県',
    '滋賀県',
    '京都府',
    '大阪府',
    '兵庫県',
    '奈良県',
    '和歌山県',
    '鳥取県',
    '島根県',
    '岡山県',
    '広島県',
    '山口県',
    '徳島県',
    '香川県',
    '愛媛県',
    '高知県',
    '福岡県',
    '佐賀県',
    '長崎県',
    '熊本県',
    '大分県',
    '宮崎県',
    '鹿児島県',
    '沖縄県',
  ];
  const prefectureRegex = new RegExp(
    `(〒?\\d{3}-\\d{4}\\s*)?(?:${prefectures.join('|')})[^\\n]{5,80}`,
    'g'
  );

  const scanText = (text: string): string | undefined => {
    const match = text.match(prefectureRegex);
    if (match && match.length > 0) {
      return stripPostalCode(match[0].replace(/\s+/g, ' ').trim());
    }
    return undefined;
  };

  for (const page of pages) {
    const contentCandidate = scanText(page.content);
    if (contentCandidate) {
      return contentCandidate;
    }
    if (page.snippet) {
      const snippetCandidate = scanText(page.snippet);
      if (snippetCandidate) {
        return snippetCandidate;
      }
    }
  }
  return undefined;
}

function heuristicScore(
  company: CompanyInfo,
  pages: PageContent[]
): ScoreResult {
  const normalizedName = company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const headquartersAddress = extractHeadquartersAddressFromPages(pages);
  const urls = pages.map((page) => {
    const normalizedUrl = page.url.toLowerCase();
    let score = 0.2;
    if (normalizedUrl.includes(normalizedName)) {
      score += 0.5;
    }
    if (
      page.snippet &&
      page.snippet.toLowerCase().includes(company.name.toLowerCase())
    ) {
      score += 0.2;
    }
    if (
      company.licenseAddress &&
      page.content
        .toLowerCase()
        .includes(company.licenseAddress.toLowerCase())
    ) {
      score += 0.1;
    }
    if (
      company.licenseNumber &&
      page.content.includes(company.licenseNumber)
    ) {
      score += 0.1;
    }
    return {
      url: getDomainUrl(page.url),
      score: Math.min(1, score),
      reason: 'Heuristic fallback score due to parsing error.',
    };
  });
  return { urls, headquartersAddress };
}

export async function scoreCandidateUrls(
  company: CompanyInfo,
  pages: PageContent[]
): Promise<ScoreResult> {
  if (pages.length === 0) {
    return { urls: [] };
  }

  const prompt = buildPrompt(company, pages);

  try {
    const response = await geminiClient.models.generateContent({
      model: appConfig.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const usageMetadata = response?.usageMetadata;
    if (usageMetadata) {
      const { promptTokenCount, candidatesTokenCount, totalTokenCount } =
        usageMetadata;
      logger.info(
        `Gemini token usage - prompt: ${promptTokenCount}, candidates: ${candidatesTokenCount}, total: ${totalTokenCount}`
      );
    } else {
      logger.info(
        'Gemini token usage metadata was not provided in the response.'
      );
    }

    const combinedText = extractTextFromGeminiResponse(response);

    const parsed = safeParseGeminiResponse(combinedText);
    if (!parsed) {
      logger.warn(
        'Gemini response could not be parsed. Falling back to heuristic scoring.'
      );
      return heuristicScore(company, pages);
    }

    const scoredUrls = pages.map((page) => {
      const sanitizedPageUrl = getDomainUrl(page.url);
      const match = parsed.urls.find((entry) => entry.url === sanitizedPageUrl);
      return (
        match ?? {
          url: sanitizedPageUrl,
          score: 0,
          reason: 'URL not scored by Gemini.',
        }
      );
    });

    const headquartersAddress =
      normalizeAddress(parsed.headquartersAddress) ??
      extractHeadquartersAddressFromPages(pages);

    return { urls: scoredUrls, headquartersAddress };
  } catch (error) {
    logger.error('Failed to score URLs with Gemini.', error);
    return heuristicScore(company, pages);
  }
}
