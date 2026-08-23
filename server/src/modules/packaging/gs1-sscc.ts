/**
 * GS1 SSCC helpers — company prefix must come from GS1 Tunisia (not the placeholder).
 */

export const PLACEHOLDER_GS1_COMPANY_PREFIX = "09999999";

export const computeGS1CheckDigit = (digits: string) => {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = parseInt(digits[digits.length - 1 - index] || "0", 10);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
};

export const normalizeGs1Prefix = (raw: unknown) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 10) return digits;
  const fromEnv = String(process.env.GS1_COMPANY_PREFIX || "").replace(/\D/g, "");
  if (fromEnv.length >= 7 && fromEnv.length <= 10) return fromEnv;
  return PLACEHOLDER_GS1_COMPANY_PREFIX;
};

export const isPlaceholderGs1Prefix = (prefix: string) =>
  normalizeGs1Prefix(prefix) === PLACEHOLDER_GS1_COMPANY_PREFIX;

/**
 * Build an 18-digit SSCC: extension digit + company prefix + serial + check digit.
 */
export const generateSSCC = (serialNumber: number, companyPrefix: string) => {
  const extension = "0";
  const prefix = normalizeGs1Prefix(companyPrefix);
  const serialWidth = Math.max(1, 16 - prefix.length);
  const serial = String(serialNumber).padStart(serialWidth, "0").slice(-serialWidth);
  const base17 = (extension + prefix + serial).slice(0, 17).padStart(17, "0");
  return base17 + computeGS1CheckDigit(base17);
};
