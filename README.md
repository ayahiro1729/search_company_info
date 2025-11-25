# Search Company URL

A TypeScript CLI utility that uses Scrapingdog, Google Custom Search, and Brave Search to gather candidate company websites and Gemini to score them, returning the best matching URL and headquarters address for a Paid Employment Placement license holder.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
npm install
```

Create a `.env` file using the provided template:

```bash
cp .env.example .env
```

Populate the environment variables:

- `SCRAPINGDOG_API_KEY` – API key for Scrapingdog (used for the first-stage Google SERP scrape).
- `SCRAPINGDOG_SEARCH_RESULT_COUNT` *(optional)* – Number of Scrapingdog results to request (default: 10).
- `GOOGLE_API_KEY` – Google API key with access to Custom Search JSON API.
- `GOOGLE_CSE_ID` – Custom Search Engine ID (cx) configured to search the public web.
- `GEMINI_API_KEY` – API key for Gemini.
- `GOOGLE_SEARCH_RESULT_COUNT` *(optional)* – Number of search results to request (default: 5).
- `GEMINI_MODEL` *(optional)* – Gemini model identifier (default: `models/gemini-1.5-pro-latest`).
- `BRAVE_API_KEY` – API key for the Brave Search API (used as a fallback when Google results score poorly).
- `BRAVE_SEARCH_RESULT_COUNT` *(optional)* – Number of Brave search results to request (default: 10).

## Available Scripts

- `npm run build` – Compile TypeScript to `dist/`.
- `npm run start -- --name "Company" --license-number "XX-YYYYYYY"` – Run the CLI using ts-node.
- `npm run dev` – Run the CLI in watch mode with `tsx`.
- `npm run lint` – Lint the source and test files with ESLint.
- `npm test` – Execute the Vitest test suite.

## Usage

```bash
npm run start -- \
  --name "Acme Corporation" \
  --license-number "13-ユ-123456" \
  --license-address "123 License St, Tokyo" \
  --description "Industrial equipment manufacturer"
```

The command prints a JSON payload containing the best matching corporate website URL and the detected headquarters address.

## Testing

Unit tests are implemented with Vitest to verify the workflow selects the highest-scoring URL and handles empty search results. Run them with:

```bash
npm test
```

## Logging and Error Handling

- Structured logging with configurable log level via `LOG_LEVEL` environment variable.
- Network and API errors are caught and logged with fallbacks where possible (e.g., heuristic scoring if Gemini output cannot be parsed).
