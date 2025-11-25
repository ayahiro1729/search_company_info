export function sanitizeAddressForQuery(address: string): string {
  const normalized = address
    .normalize('NFKC')
    .replace(/号室/g, '')
    .replace(/["'“”‘’「」『』【】]/g, ' ')
    .replace(/([0-9]+)丁目/g, '$1-')
    .replace(/([0-9]+)番地?/g, '$1-')
    .replace(/([0-9]+)号/g, '$1-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/g, '')
    .trim();

  const buildingKeywords = [
    'ビル',
    'マンション',
    'ハイツ',
    'コーポ',
    'アパート',
    'レジデンス',
    'タワー',
    'ヒルズ',
    'プラザ',
    'パレス',
    'ステージ',
    'ハウス',
    'メゾン',
    'BLDG',
    'Building',
    'BUILDING',
  ];

  let trimmed = normalized;
  for (const keyword of buildingKeywords) {
    const index = trimmed.indexOf(keyword);
    if (index !== -1) {
      trimmed = trimmed.slice(0, index);
    }
  }

  const lastHyphenIndex = trimmed.lastIndexOf('-');
  if (lastHyphenIndex !== -1) {
    const suffix = trimmed.slice(lastHyphenIndex + 1).trim();
    if (/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(suffix)) {
      trimmed = trimmed.slice(0, lastHyphenIndex);
    }
  }

  trimmed = trimmed.trim();

  if (!trimmed) {
    return normalized;
  }

  return trimmed.replace(/-$/g, '');
}
