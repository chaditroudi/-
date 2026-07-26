const normalize = (value: unknown) => String(value || "").trim();

export const extractScanReferences = (value: unknown): string[] => {
  const raw = normalize(value);
  if (!raw) return [];
  const references = new Set<string>([raw]);

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    [
      "stock_lot_id", "stockLotId", "lot_id", "lotId", "lot_code",
      "lot_number", "lot_internal", "barcode", "unit_barcode",
      "qr_code_payload", "qr_label_text", "sscc", "location_code",
    ].forEach((key) => {
      const candidate = normalize(parsed[key]);
      if (candidate) references.add(candidate);
    });
  } catch {
    // Plain barcode/URL/label text.
  }

  try {
    const url = new URL(raw, "https://scan.local");
    ["lot", "lotId", "lot_id", "sscc", "location", "locationCode"].forEach((key) => {
      const candidate = normalize(url.searchParams.get(key));
      if (candidate) references.add(candidate);
    });
    const passport = url.hash.match(/passport\/([^/?#]+)/i);
    if (passport?.[1]) references.add(decodeURIComponent(passport[1]));
  } catch {
    // Not a URL.
  }

  raw.split("|").map(normalize).filter(Boolean).forEach((part) => references.add(part));
  return Array.from(references);
};

export const classifyScan = (rawValue: unknown) => {
  const raw = normalize(rawValue);
  if (/^\d{18}$/.test(raw)) return "SSCC" as const;
  if (/^[A-Z]{2}-(?:[A-Z]\d|\d{2})-\d{2}-\d{2}-\d$/i.test(raw)) return "LOCATION" as const;
  if (/passport\//i.test(raw)) return "LOT" as const;
  if (/^(LOT|STK|UNIT|PAL)[-_]/i.test(raw)) return "LOT" as const;
  return "UNKNOWN" as const;
};
