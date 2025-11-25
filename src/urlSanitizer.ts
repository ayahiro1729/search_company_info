const PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function getDomainUrl(rawUrl: string): string {
  if (!rawUrl) {
    return '';
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const normalized = PROTOCOL_PATTERN.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(normalized);
    const origin = url.origin;
    return origin.endsWith('/') ? origin : `${origin}/`;
  } catch (_error) {
    return trimmed;
  }
}
