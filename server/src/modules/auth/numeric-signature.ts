import bcrypt from "bcryptjs";

import { badRequest, unauthorized } from "../../core/app-error.js";
import { AuthUserModel } from "../../models/auth-user.model.js";
import { factoryUserFilter } from "../../db/factory-context.js";

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

export type NumericSignatureGate = "off" | "warn" | "enforce";

export type SignaturePinResult = {
  verified: boolean;
  skipped: boolean;
  userId: string;
  email: string | null;
  fullName: string;
};

const nowIso = () => new Date().toISOString();

export const numericSignatureGateMode = (): NumericSignatureGate => {
  const raw = String(process.env.NUMERIC_SIGNATURE_GATE || "warn").trim().toLowerCase();
  if (raw === "off" || raw === "false" || raw === "0") return "off";
  if (raw === "enforce" || raw === "on" || raw === "true" || raw === "1") return "enforce";
  return "warn";
};

/**
 * A QC release fails closed: production always enforces, and anywhere else a
 * weaker mode must be asked for explicitly with NUMERIC_SIGNATURE_GATE.
 */
export const releaseSignatureGateMode = (): NumericSignatureGate => {
  if (process.env.NODE_ENV === "production") return "enforce";
  return String(process.env.NUMERIC_SIGNATURE_GATE || "").trim() ? numericSignatureGateMode() : "enforce";
};

export const isValidPinFormat = (pin: string): boolean =>
  /^\d+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH;

export const hashSignaturePin = async (pin: string): Promise<string> => {
  if (!isValidPinFormat(pin)) {
    throw badRequest(
      "INVALID_PIN_FORMAT",
      `Le code signature doit contenir ${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH} chiffres.`,
    );
  }
  return bcrypt.hash(pin, 10);
};

export const getStoredPinHash = (user: any): string | null => {
  if (typeof user?.signaturePinHash === "string" && user.signaturePinHash.length > 0) {
    return user.signaturePinHash;
  }
  if (typeof user?.signature_pin_hash === "string" && user.signature_pin_hash.length > 0) {
    return user.signature_pin_hash;
  }
  return null;
};

export const userHasSignaturePin = (user: any): boolean => Boolean(getStoredPinHash(user));

const displayName = (user: any): string => {
  const meta = user?.user_metadata || {};
  const name = String(meta.full_name || meta.name || "").trim();
  if (name) return name;
  const email = String(user?.email || "").trim();
  return email ? email.split("@")[0] : "Utilisateur";
};

/**
 * Verify a numeric signature PIN for a user.
 * - Wrong PIN always fails.
 * - Missing PIN / unset PIN: off=skip, warn=allow unverified, enforce=reject.
 * - Unknown user: off/warn allow unverified; enforce rejects.
 */
export const assertSignaturePin = async (
  userId: string,
  pin: string | null | undefined,
  context?: { action?: string; entityId?: string; displayName?: string },
): Promise<SignaturePinResult> => {
  const gate = context?.action === "qc_release" ? releaseSignatureGateMode() : numericSignatureGateMode();
  const id = String(userId || "").trim();
  if (!id) {
    throw badRequest("SIGNER_ID_REQUIRED", "Identifiant du signataire requis.");
  }

  const fallbackName = String(context?.displayName || "").trim() || id;

  if (gate === "off") {
    return {
      verified: false,
      skipped: true,
      userId: id,
      email: null,
      fullName: fallbackName,
    };
  }

  const user = await AuthUserModel.findOne(factoryUserFilter({ id, is_active: true })).lean().exec();
  if (!user) {
    const message = "Signataire introuvable ou inactif.";
    if (gate === "enforce") {
      throw unauthorized(message);
    }
    console.warn(`[numeric-signature] ${message}`, context || {});
    return {
      verified: false,
      skipped: false,
      userId: id,
      email: null,
      fullName: fallbackName,
    };
  }

  const base: SignaturePinResult = {
    verified: false,
    skipped: false,
    userId: id,
    email: typeof (user as any).email === "string" ? (user as any).email : null,
    fullName: displayName(user) || fallbackName,
  };

  const stored = getStoredPinHash(user);
  const pinValue = String(pin ?? "").trim();

  if (!stored) {
    const message = "Aucun code signature configuré pour cet utilisateur.";
    if (gate === "enforce") {
      throw badRequest("PIN_NOT_CONFIGURED", message, context);
    }
    console.warn(`[numeric-signature] ${message}`, context || {});
    return base;
  }

  if (!pinValue) {
    const message = "Code signature requis pour cette action.";
    if (gate === "enforce") {
      throw badRequest("PIN_REQUIRED", message, context);
    }
    console.warn(`[numeric-signature] ${message}`, context || {});
    return base;
  }

  if (!isValidPinFormat(pinValue)) {
    throw badRequest(
      "INVALID_PIN_FORMAT",
      `Le code signature doit contenir ${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH} chiffres.`,
    );
  }

  const matches = await bcrypt.compare(pinValue, stored);
  if (!matches) {
    throw unauthorized("Code signature incorrect.");
  }

  return { ...base, verified: true };
};

export const setUserSignaturePin = async (userId: string, pin: string) => {
  const hash = await hashSignaturePin(pin);
  const result = await AuthUserModel.updateOne(
    factoryUserFilter({ id: userId }),
    { $set: { signaturePinHash: hash, updated_at: nowIso() } },
  ).exec();
  if (!result.matchedCount) {
    throw badRequest("USER_NOT_FOUND", "Utilisateur introuvable.");
  }
  return { ok: true as const, has_signature_pin: true };
};

export const clearUserSignaturePin = async (userId: string) => {
  const result = await AuthUserModel.updateOne(
    factoryUserFilter({ id: userId }),
    { $unset: { signaturePinHash: 1, signature_pin_hash: 1 }, $set: { updated_at: nowIso() } },
  ).exec();
  if (!result.matchedCount) {
    throw badRequest("USER_NOT_FOUND", "Utilisateur introuvable.");
  }
  return { ok: true as const, has_signature_pin: false };
};
