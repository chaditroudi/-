/**
 * Wave C — grade-based supplier/farmer settlement + FX helpers.
 * Pure domain (no I/O) so unit tests stay free of mongoose.
 */
export const SETTLEMENT_GRADES = [
    "EXTRA",
    "CATEGORIE_I",
    "CATEGORIE_II",
    "REJETE",
];
const roundMoney = (value) => Math.round(value * 10000) / 10000;
const toKg = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
const toPrice = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
};
/**
 * Resolve TND/kg for a grade. REJETE defaults to 0 unless explicitly priced.
 * Other grades fall back to flat agreed_price_tnd_per_kg.
 */
export const resolveGradePriceTndPerKg = (input) => {
    const grade = String(input.grade || "").toUpperCase();
    const book = input.gradePrices || {};
    const fromBook = book[grade];
    if (fromBook != null && Number.isFinite(Number(fromBook))) {
        return toPrice(fromBook);
    }
    if (grade === "REJETE")
        return 0;
    return toPrice(input.agreedPriceTndPerKg);
};
export const computeGradeSettlement = (input) => {
    const lines = input.lines
        .map((row) => {
        const weightKg = toKg(row.weightKg);
        const price = resolveGradePriceTndPerKg({
            grade: row.grade,
            gradePrices: input.gradePrices,
            agreedPriceTndPerKg: input.agreedPriceTndPerKg,
        });
        return {
            grade: String(row.grade || ""),
            weight_kg: weightKg,
            price_tnd_per_kg: price,
            amount_tnd: roundMoney(weightKg * price),
            lot_number: row.lotNumber ? String(row.lotNumber) : null,
        };
    })
        .filter((row) => row.weight_kg > 0);
    const totalWeightKg = roundMoney(lines.reduce((sum, row) => sum + row.weight_kg, 0));
    const totalAmountTnd = roundMoney(lines.reduce((sum, row) => sum + row.amount_tnd, 0));
    const payableWeightKg = roundMoney(lines.filter((row) => row.grade !== "REJETE").reduce((sum, row) => sum + row.weight_kg, 0));
    return { lines, totalWeightKg, totalAmountTnd, payableWeightKg };
};
export const DEFAULT_FX_TO_TND = {
    EUR: 3.35,
    USD: 3.1,
    SAR: 0.83,
    TND: 1,
};
/** Convert invoice-currency amount to TND. */
export const convertToTnd = (input) => {
    const currency = String(input.currency || "TND").toUpperCase();
    const override = Number(input.overrideRate);
    const fromBook = Number(input.fxRatesToTnd?.[currency]);
    const fallback = Number(DEFAULT_FX_TO_TND[currency]);
    const fxRateToTnd = Number.isFinite(override) && override > 0
        ? override
        : Number.isFinite(fromBook) && fromBook > 0
            ? fromBook
            : Number.isFinite(fallback) && fallback > 0
                ? fallback
                : 1;
    const amount = Number(input.amount);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return {
        currency,
        fxRateToTnd,
        amountTnd: roundMoney(safeAmount * fxRateToTnd),
    };
};
export const computeExportMargin = (input) => {
    const converted = convertToTnd({
        amount: input.revenueInvoice,
        currency: input.currency,
        fxRatesToTnd: input.fxRatesToTnd,
        overrideRate: input.overrideRate,
    });
    const costTnd = Number.isFinite(Number(input.costTnd)) ? Number(input.costTnd) : 0;
    const marginTnd = roundMoney(converted.amountTnd - costTnd);
    const marginPct = converted.amountTnd > 0 ? roundMoney((marginTnd / converted.amountTnd) * 100) : 0;
    return {
        ...converted,
        revenueInvoice: roundMoney(Number(input.revenueInvoice) || 0),
        costTnd: roundMoney(costTnd),
        marginTnd,
        marginPct,
    };
};
