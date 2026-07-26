/**
 * Wave B margin — pure cost allocation over graded outputs.
 *
 * Input purchase cost is spread across output streams by weight × relative
 * value weight. Streams with valueWeight 0 (reject / destruction) absorb no
 * cost, so yield loss inflates the unit cost of the good grades.
 */
const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const roundMoney = (value) => Number(value.toFixed(4));
/**
 * Allocate `inputCostTnd` across `outputs`. Waste/reject streams pass
 * `valueWeight: 0` so they take no cost and inflate good-grade unit costs.
 */
export const allocateCostByWeight = (input) => {
    const inputCostTnd = Math.max(0, toNumber(input.inputCostTnd));
    const streams = (input.outputs || []).map((stream) => {
        const weightKg = Math.max(0, toNumber(stream.weightKg));
        const rawValue = stream.valueWeight;
        const valueWeight = rawValue === undefined || rawValue === null ? 1 : Math.max(0, toNumber(rawValue));
        return { id: String(stream.id || ""), weightKg, valueWeight };
    });
    const totalWeightKg = streams.reduce((sum, stream) => sum + stream.weightKg, 0);
    const weightedMass = streams.reduce((sum, stream) => sum + stream.weightKg * stream.valueWeight, 0);
    const costBearingWeightKg = streams
        .filter((stream) => stream.valueWeight > 0)
        .reduce((sum, stream) => sum + stream.weightKg, 0);
    if (inputCostTnd <= 0 || weightedMass <= 0) {
        return {
            inputCostTnd,
            allocatedCostTnd: 0,
            unallocatedCostTnd: inputCostTnd,
            totalWeightKg: roundMoney(totalWeightKg),
            costBearingWeightKg: roundMoney(costBearingWeightKg),
            streams: streams.map((stream) => ({
                ...stream,
                costTnd: 0,
                costTndPerKg: 0,
            })),
        };
    }
    const allocated = streams.map((stream) => {
        const share = (stream.weightKg * stream.valueWeight) / weightedMass;
        const costTnd = roundMoney(inputCostTnd * share);
        const costTndPerKg = stream.weightKg > 0 ? roundMoney(costTnd / stream.weightKg) : 0;
        return { ...stream, costTnd, costTndPerKg };
    });
    // Absorb rounding residue on the largest cost-bearing stream so totals match.
    const allocatedCostTnd = roundMoney(allocated.reduce((sum, stream) => sum + stream.costTnd, 0));
    const residue = roundMoney(inputCostTnd - allocatedCostTnd);
    if (residue !== 0) {
        let targetIndex = -1;
        let targetWeight = -1;
        for (let index = 0; index < allocated.length; index += 1) {
            const stream = allocated[index];
            if (stream.valueWeight > 0 && stream.weightKg > targetWeight) {
                targetWeight = stream.weightKg;
                targetIndex = index;
            }
        }
        if (targetIndex >= 0) {
            const target = allocated[targetIndex];
            target.costTnd = roundMoney(target.costTnd + residue);
            target.costTndPerKg =
                target.weightKg > 0 ? roundMoney(target.costTnd / target.weightKg) : 0;
        }
    }
    const finalAllocated = roundMoney(allocated.reduce((sum, stream) => sum + stream.costTnd, 0));
    return {
        inputCostTnd: roundMoney(inputCostTnd),
        allocatedCostTnd: finalAllocated,
        unallocatedCostTnd: roundMoney(inputCostTnd - finalAllocated),
        totalWeightKg: roundMoney(totalWeightKg),
        costBearingWeightKg: roundMoney(costBearingWeightKg),
        streams: allocated,
    };
};
/** Snapshot purchase cost onto a lot from a supplier agreed price. */
export const snapshotPurchaseCost = (input) => {
    const quantityKg = Math.max(0, toNumber(input.quantityKg));
    if (input.agreedPriceTndPerKg === null ||
        input.agreedPriceTndPerKg === undefined) {
        return {
            purchase_cost_tnd_per_kg: null,
            purchase_cost_tnd: null,
            cost_source: null,
        };
    }
    const price = toNumber(input.agreedPriceTndPerKg, Number.NaN);
    if (!Number.isFinite(price) || price < 0 || quantityKg <= 0) {
        return {
            purchase_cost_tnd_per_kg: null,
            purchase_cost_tnd: null,
            cost_source: null,
        };
    }
    return {
        purchase_cost_tnd_per_kg: roundMoney(price),
        purchase_cost_tnd: roundMoney(price * quantityKg),
        cost_source: input.costSource || "supplier.agreed_price_tnd_per_kg",
    };
};
