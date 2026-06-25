var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
const Missions = () => getCollectionModel("transport_missions");
const Vehicles = () => getCollectionModel("transport_vehicles");
const Drivers = () => getCollectionModel("transport_drivers");
const Alerts = () => getCollectionModel("alerts");
const ALLOWED_TRANSITIONS = {
    PLANNED: ["ASSIGNED", "CANCELLED"],
    ASSIGNED: ["IN_TRANSIT", "CANCELLED"],
    IN_TRANSIT: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
};
let TransportService = class TransportService {
    // ── Assign vehicle + driver to mission ───────────────────────────────────
    async assignMission(missionId, body, actor) {
        const mission = sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
        if (!mission)
            throw notFound("MISSION_NOT_FOUND", `Mission ${missionId} introuvable`);
        const status = mission.status;
        if (!ALLOWED_TRANSITIONS[status]?.includes("ASSIGNED")) {
            throw badRequest("INVALID_TRANSITION", `Mission en statut ${status} ne peut pas être assignée`);
        }
        const vehicleId = String(body.vehicle_id ?? "");
        const driverId = String(body.driver_id ?? "");
        // RG-T01: vehicle must be AVAILABLE
        if (vehicleId) {
            const vehicle = sanitizeDocument(await Vehicles().findOne({ id: vehicleId }).lean().exec());
            if (!vehicle)
                throw notFound("VEHICLE_NOT_FOUND", `Véhicule ${vehicleId} introuvable`);
            if (vehicle.status !== "AVAILABLE") {
                throw badRequest("VEHICLE_NOT_AVAILABLE", `Véhicule ${vehicle.vehicle_code ?? vehicleId} non disponible (statut: ${vehicle.status})`);
            }
            // RG-T02: no active mission for this vehicle
            const activeMission = sanitizeDocument(await Missions()
                .findOne({ vehicle_id: vehicleId, status: { $in: ["ASSIGNED", "IN_TRANSIT"] } })
                .lean()
                .exec());
            if (activeMission && activeMission.id !== missionId) {
                throw badRequest("VEHICLE_ON_MISSION", `Véhicule déjà en mission ${activeMission.mission_number}`);
            }
        }
        // RG-T01: driver must be AVAILABLE
        if (driverId) {
            const driver = sanitizeDocument(await Drivers().findOne({ id: driverId }).lean().exec());
            if (!driver)
                throw notFound("DRIVER_NOT_FOUND", `Chauffeur ${driverId} introuvable`);
            if (driver.status !== "AVAILABLE") {
                throw badRequest("DRIVER_NOT_AVAILABLE", `Chauffeur ${driver.first_name ?? driverId} non disponible (statut: ${driver.status})`);
            }
            // RG-T02: no active mission for this driver
            const activeMission = sanitizeDocument(await Missions()
                .findOne({ driver_id: driverId, status: { $in: ["ASSIGNED", "IN_TRANSIT"] } })
                .lean()
                .exec());
            if (activeMission && activeMission.id !== missionId) {
                throw badRequest("DRIVER_ON_MISSION", `Chauffeur déjà en mission ${activeMission.mission_number}`);
            }
        }
        const now = new Date().toISOString();
        const update = { status: "ASSIGNED", updated_at: now };
        if (vehicleId)
            update.vehicle_id = vehicleId;
        if (driverId)
            update.driver_id = driverId;
        if (body.planned_departure_at)
            update.planned_departure_at = body.planned_departure_at;
        await Missions().updateOne({ id: missionId }, { $set: update });
        if (vehicleId) {
            await Vehicles().updateOne({ id: vehicleId }, { $set: { status: "ASSIGNED", updated_at: now } });
        }
        if (driverId) {
            await Drivers().updateOne({ id: driverId }, { $set: { status: "ASSIGNED", updated_at: now } });
        }
        return sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
    }
    // ── Start mission: ASSIGNED → IN_TRANSIT ─────────────────────────────────
    async startMission(missionId, actor) {
        const mission = sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
        if (!mission)
            throw notFound("MISSION_NOT_FOUND", `Mission ${missionId} introuvable`);
        if (mission.status !== "ASSIGNED") {
            throw badRequest("INVALID_TRANSITION", `Mission doit être ASSIGNED pour démarrer (actuel: ${mission.status})`);
        }
        if (!mission.vehicle_id || !mission.driver_id) {
            throw badRequest("MISSING_ASSIGNMENT", "Véhicule et chauffeur doivent être assignés avant départ");
        }
        const now = new Date().toISOString();
        await Missions().updateOne({ id: missionId }, { $set: { status: "IN_TRANSIT", actual_departure_at: now, tracking_active: true, updated_at: now } });
        // RG-T04: update vehicle and driver status
        await Promise.all([
            Vehicles().updateOne({ id: mission.vehicle_id }, { $set: { status: "ON_MISSION", updated_at: now } }),
            Drivers().updateOne({ id: mission.driver_id }, { $set: { status: "ON_MISSION", updated_at: now } }),
        ]);
        return sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
    }
    // ── Complete mission: IN_TRANSIT → COMPLETED ──────────────────────────────
    async completeMission(missionId, body, actor) {
        const mission = sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
        if (!mission)
            throw notFound("MISSION_NOT_FOUND", `Mission ${missionId} introuvable`);
        if (mission.status !== "IN_TRANSIT") {
            throw badRequest("INVALID_TRANSITION", `Mission doit être IN_TRANSIT pour être complétée (actuel: ${mission.status})`);
        }
        const now = new Date().toISOString();
        const departureAt = mission.actual_departure_at;
        let actualDurationMin = null;
        if (departureAt) {
            const diffMs = new Date(now).getTime() - new Date(departureAt).getTime();
            actualDurationMin = Math.round(diffMs / 60000);
        }
        await Missions().updateOne({ id: missionId }, {
            $set: {
                status: "COMPLETED",
                actual_arrival_at: now,
                actual_duration_min: actualDurationMin,
                actual_distance_km: body.actual_distance_km ?? null,
                completion_notes: body.notes ?? null,
                tracking_active: false,
                updated_at: now,
            },
        });
        // RG-T05: restore vehicle and driver to AVAILABLE
        await Promise.all([
            mission.vehicle_id
                ? Vehicles().updateOne({ id: mission.vehicle_id }, { $set: { status: "AVAILABLE", updated_at: now } })
                : Promise.resolve(),
            mission.driver_id
                ? Drivers().updateOne({ id: mission.driver_id }, { $set: { status: "AVAILABLE", updated_at: now } })
                : Promise.resolve(),
        ]);
        return sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
    }
    // ── Cancel mission ────────────────────────────────────────────────────────
    async cancelMission(missionId, reason, actor) {
        const mission = sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
        if (!mission)
            throw notFound("MISSION_NOT_FOUND", `Mission ${missionId} introuvable`);
        const status = mission.status;
        // RG-T06: cannot cancel IN_TRANSIT
        if (status === "IN_TRANSIT") {
            throw badRequest("CANNOT_CANCEL_IN_TRANSIT", "Impossible d'annuler une mission en cours de transit (sécurité chauffeur)");
        }
        if (status === "COMPLETED" || status === "CANCELLED") {
            throw badRequest("INVALID_TRANSITION", `Mission déjà en statut ${status}`);
        }
        const now = new Date().toISOString();
        await Missions().updateOne({ id: missionId }, { $set: { status: "CANCELLED", cancel_reason: reason, tracking_active: false, updated_at: now } });
        // Release vehicle and driver
        await Promise.all([
            mission.vehicle_id
                ? Vehicles().updateOne({ id: mission.vehicle_id }, { $set: { status: "AVAILABLE", updated_at: now } })
                : Promise.resolve(),
            mission.driver_id
                ? Drivers().updateOne({ id: mission.driver_id }, { $set: { status: "AVAILABLE", updated_at: now } })
                : Promise.resolve(),
        ]);
        return sanitizeDocument(await Missions().findOne({ id: missionId }).lean().exec());
    }
    // ── Summary KPIs ──────────────────────────────────────────────────────────
    async getSummary() {
        const today = new Date().toISOString().slice(0, 10);
        const [missions, vehicles, drivers] = await Promise.all([
            getCollectionModel("transport_missions").find({}).lean().exec(),
            getCollectionModel("transport_vehicles").find({}).lean().exec(),
            getCollectionModel("transport_drivers").find({}).lean().exec(),
        ]);
        const ms = sanitizeDocument(missions);
        const vs = sanitizeDocument(vehicles);
        const ds = sanitizeDocument(drivers);
        return {
            missions: {
                planned: ms.filter((m) => m.status === "PLANNED").length,
                assigned: ms.filter((m) => m.status === "ASSIGNED").length,
                inTransit: ms.filter((m) => m.status === "IN_TRANSIT").length,
                completedToday: ms.filter((m) => m.status === "COMPLETED" && String(m.actual_arrival_at ?? "").startsWith(today)).length,
            },
            vehicles: {
                total: vs.length,
                available: vs.filter((v) => v.status === "AVAILABLE").length,
                onMission: vs.filter((v) => v.status === "ON_MISSION" || v.status === "ASSIGNED").length,
            },
            drivers: {
                total: ds.length,
                available: ds.filter((d) => d.status === "AVAILABLE").length,
                onMission: ds.filter((d) => d.status === "ON_MISSION" || d.status === "ASSIGNED").length,
            },
        };
    }
};
TransportService = __decorate([
    Injectable()
], TransportService);
export { TransportService };
