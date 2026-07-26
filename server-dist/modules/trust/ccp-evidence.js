import { createHash } from "node:crypto";
const avgConcentration = (reading) => {
    if (reading.concentration_avg_gm3 != null && Number.isFinite(Number(reading.concentration_avg_gm3))) {
        return Number(reading.concentration_avg_gm3);
    }
    const points = [
        reading.concentration_p1_gm3,
        reading.concentration_p2_gm3,
        reading.concentration_p3_gm3,
        reading.concentration_p4_gm3,
    ]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    if (points.length === 0)
        return null;
    return points.reduce((sum, value) => sum + value, 0) / points.length;
};
export const digestReadings = (readings) => {
    const normalized = readings
        .map((row) => ({
        at: String(row.read_at || row.reading_at || ""),
        values: Object.keys(row)
            .filter((key) => !["id", "signature", "secret", "_id"].includes(key))
            .sort()
            .map((key) => [key, row[key]]),
    }))
        .sort((a, b) => a.at.localeCompare(b.at));
    return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};
export const evaluateFumigationCcp = (input) => {
    const missing = [];
    const readings = [...input.readings].sort((a, b) => String(a.read_at || "").localeCompare(String(b.read_at || "")));
    if (readings.length === 0)
        missing.push("readings");
    if (!input.t0Start)
        missing.push("t0_start");
    const protocol = input.protocolConfig || {
        min_duration_min: 240,
        min_avg_concentration_gm3: 0.5,
        max_external_leak_ppm: 0.3,
    };
    const nowMs = new Date(input.now || new Date().toISOString()).getTime();
    const startMs = input.t0Start ? new Date(input.t0Start).getTime() : NaN;
    const durationMinutes = Number.isFinite(startMs)
        ? Math.max(0, Math.round((nowMs - startMs) / 60_000))
        : 0;
    const durationCompliant = durationMinutes >= protocol.min_duration_min;
    const concentrations = readings
        .map(avgConcentration)
        .filter((value) => value != null && Number.isFinite(value));
    const minConcentration = concentrations.length ? Math.min(...concentrations) : null;
    const avgConcentrationValue = concentrations.length
        ? concentrations.reduce((sum, value) => sum + value, 0) / concentrations.length
        : null;
    const minRequired = protocol.min_avg_concentration_gm3 ?? 0.5;
    const parametersCompliant = avgConcentrationValue != null && avgConcentrationValue >= minRequired;
    const leakEvents = readings.filter((reading) => Number(reading.external_leak_ppm || 0) > (protocol.max_external_leak_ppm ?? 0.3)).length;
    const doorBreaches = readings.filter((reading) => reading.door_locked === false).length;
    const deviceVerifiedCount = readings.filter((reading) => reading.source === "DEVICE" && reading.signature_verified === true).length;
    // CT approximation: average concentration × elapsed hours while readings exist.
    const ctProduct = avgConcentrationValue != null && durationMinutes > 0
        ? Number(((avgConcentrationValue * durationMinutes) / 60).toFixed(3))
        : null;
    const residualCompliant = leakEvents === 0;
    const compliant = missing.length === 0
        && durationCompliant
        && parametersCompliant
        && residualCompliant
        && doorBreaches === 0;
    return {
        compliant,
        durationCompliant,
        parametersCompliant,
        residualCompliant,
        durationMinutes,
        minConcentrationGm3: minConcentration,
        avgConcentrationGm3: avgConcentrationValue,
        ctProduct,
        readingCount: readings.length,
        deviceVerifiedCount,
        leakEvents,
        doorBreaches,
        missing,
        readingsDigest: digestReadings(readings),
    };
};
export const evaluateColdChain = (input) => {
    const maxC = input.temperatureMaxC ?? 8;
    const minC = input.temperatureMinC ?? -2;
    const excursions = input.readings.filter((reading) => {
        const temperature = Number(reading.temperature_c);
        if (!Number.isFinite(temperature))
            return false;
        return temperature > maxC || temperature < minC;
    });
    const critical = input.readings.filter((reading) => reading.condition_status === "critical");
    const intact = excursions.length === 0 && critical.length === 0;
    const maxDeviation = excursions.reduce((worst, reading) => {
        const temperature = Number(reading.temperature_c);
        const high = Math.max(0, temperature - maxC);
        const low = Math.max(0, minC - temperature);
        return Math.max(worst, high, low);
    }, 0);
    return {
        intact,
        excursionCount: excursions.length,
        criticalCount: critical.length,
        maxDeviationC: Number(maxDeviation.toFixed(2)),
        readingCount: input.readings.length,
        deviceVerifiedCount: input.readings.filter((reading) => reading.source === "DEVICE" && reading.signature_verified === true).length,
        readingsDigest: digestReadings(input.readings),
    };
};
export const ccpGateMode = () => {
    const value = String(process.env.TRUST_CCP_GATE || "warn").toLowerCase();
    return value === "off" || value === "enforce" ? value : "warn";
};
