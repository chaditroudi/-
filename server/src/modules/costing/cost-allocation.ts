/**
 * Wave B margin — pure cost allocation over graded outputs.
 *
 * Input purchase cost is spread across output streams by weight × relative
 * value weight. Streams with valueWeight 0 (reject / destruction) absorb no
 * cost, so yield loss inflates the unit cost of the good grades.
 */

export type CostOutputStream = {
  id: string;
  weightKg: number;
  /** Relative commercial value per kg (0 = waste / reject). Default 1. */
  valueWeight?: number;
};

export type AllocatedCostStream = {
  id: string;
  weightKg: number;
  valueWeight: number;
  costTnd: number;
  costTndPerKg: number;
};

export type CostAllocationResult = {
  inputCostTnd: number;
  allocatedCostTnd: number;
  unallocatedCostTnd: number;
  totalWeightKg: number;
  costBearingWeightKg: number;
  streams: AllocatedCostStream[];
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value: number) => Number(value.toFixed(4));

export type StandardCostRates = {
  labourRateTndPerHour: number;
  energyTariffTndPerKwh: number;
  overheadTndPerKg: number;
};

export type AbsorbedCostBreakdown = {
  materialCostTnd: number;
  labourCostTnd: number;
  energyCostTnd: number;
  overheadCostTnd: number;
  totalCostTnd: number;
  /** True when labour/energy/overhead came from site standard rates, not meters. */
  standardCost: true;
};

/**
 * Build a total process cost from material + standard labour/energy/overhead.
 * Labelled `standardCost: true` so callers never confuse these with actuals.
 */
export const absorbStandardCosts = (input: {
  materialCostTnd: number;
  workerCount?: number | null;
  durationMinutes?: number | null;
  energyKwh?: number | null;
  outputKg?: number | null;
  rates: StandardCostRates;
}): AbsorbedCostBreakdown => {
  const materialCostTnd = Math.max(0, toNumber(input.materialCostTnd));
  const workerCount = Math.max(0, toNumber(input.workerCount));
  const durationHours = Math.max(0, toNumber(input.durationMinutes)) / 60;
  const energyKwh = Math.max(0, toNumber(input.energyKwh));
  const outputKg = Math.max(0, toNumber(input.outputKg));

  const labourCostTnd = roundMoney(
    workerCount * durationHours * Math.max(0, toNumber(input.rates.labourRateTndPerHour)),
  );
  const energyCostTnd = roundMoney(
    energyKwh * Math.max(0, toNumber(input.rates.energyTariffTndPerKwh)),
  );
  const overheadCostTnd = roundMoney(
    outputKg * Math.max(0, toNumber(input.rates.overheadTndPerKg)),
  );
  const totalCostTnd = roundMoney(
    materialCostTnd + labourCostTnd + energyCostTnd + overheadCostTnd,
  );

  return {
    materialCostTnd: roundMoney(materialCostTnd),
    labourCostTnd,
    energyCostTnd,
    overheadCostTnd,
    totalCostTnd,
    standardCost: true,
  };
};

/**
 * Allocate `inputCostTnd` across `outputs`. Waste/reject streams pass
 * `valueWeight: 0` so they take no cost and inflate good-grade unit costs.
 */
export const allocateCostByWeight = (input: {
  inputCostTnd: number;
  outputs: CostOutputStream[];
}): CostAllocationResult => {
  const inputCostTnd = Math.max(0, toNumber(input.inputCostTnd));
  const streams = (input.outputs || []).map((stream) => {
    const weightKg = Math.max(0, toNumber(stream.weightKg));
    const rawValue = stream.valueWeight;
    const valueWeight =
      rawValue === undefined || rawValue === null ? 1 : Math.max(0, toNumber(rawValue));
    return { id: String(stream.id || ""), weightKg, valueWeight };
  });

  const totalWeightKg = streams.reduce((sum, stream) => sum + stream.weightKg, 0);
  const weightedMass = streams.reduce(
    (sum, stream) => sum + stream.weightKg * stream.valueWeight,
    0,
  );
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
  const allocatedCostTnd = roundMoney(
    allocated.reduce((sum, stream) => sum + stream.costTnd, 0),
  );
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
export const snapshotPurchaseCost = (input: {
  quantityKg: number;
  agreedPriceTndPerKg: number | null | undefined;
  costSource?: string;
}) => {
  const quantityKg = Math.max(0, toNumber(input.quantityKg));
  if (
    input.agreedPriceTndPerKg === null ||
    input.agreedPriceTndPerKg === undefined
  ) {
    return {
      purchase_cost_tnd_per_kg: null as number | null,
      purchase_cost_tnd: null as number | null,
      cost_source: null as string | null,
    };
  }
  const price = toNumber(input.agreedPriceTndPerKg, Number.NaN);
  if (!Number.isFinite(price) || price < 0 || quantityKg <= 0) {
    return {
      purchase_cost_tnd_per_kg: null as number | null,
      purchase_cost_tnd: null as number | null,
      cost_source: null as string | null,
    };
  }
  return {
    purchase_cost_tnd_per_kg: roundMoney(price),
    purchase_cost_tnd: roundMoney(price * quantityKg),
    cost_source: input.costSource || "supplier.agreed_price_tnd_per_kg",
  };
};
