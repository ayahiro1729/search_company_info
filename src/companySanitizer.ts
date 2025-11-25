const FULL_WIDTH_ALPHANUMERIC = /[Ａ-Ｚａ-ｚ０-９]/g;
const FULL_WIDTH_SPACE = /\u3000/g;
const FULL_WIDTH_DASH = /[－ー−–―]/g;

export function sanitizeCompanyNameForQuery(name: string): string {
  return name
    .replace(FULL_WIDTH_SPACE, ' ')
    .replace(FULL_WIDTH_ALPHANUMERIC, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    );
}

export function sanitizeLicenseNumberForQuery(licenseNumber: string): string {
  return licenseNumber
    .replace(FULL_WIDTH_SPACE, ' ')
    .replace(FULL_WIDTH_ALPHANUMERIC, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(FULL_WIDTH_DASH, '-')
    .replace(/\s+/g, ' ')
    .trim();
 }
