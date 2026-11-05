import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";
import { AppError, badRequest, unauthorized } from "../../core/app-error.js";
import { factoryFromAccount, sameFactory } from "../../db/factory-context.js";
import { sanitizeDocument } from "../../db/dynamic-model.js";
import { invalidateAuthCache } from "../../middleware/auth.js";
import { AuthUserModel } from "../../models/auth-user.model.js";
import {
  clearUserSignaturePin,
  setUserSignaturePin,
  userHasSignaturePin,
} from "./numeric-signature.js";

const nowIso = () => new Date().toISOString();

export const MIN_PASSWORD_LENGTH = 10;

export const assertPasswordStrength = (password: string) => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(
      "PASSWORD_TOO_SHORT",
      `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    );
  }
};

const getStoredPasswordHash = (user: any) => {
  if (typeof user?.passwordHash === "string" && user.passwordHash.length > 0) return user.passwordHash;
  if (typeof user?.password_hash === "string" && user.password_hash.length > 0) return user.password_hash;
  return null;
};

const toPublicUser = (user: any) => ({
  id: user.id,
  email: user.email,
  ...factoryFromAccount(user),
  user_metadata: sanitizeDocument(user.user_metadata || {}),
  has_signature_pin: userHasSignaturePin(user),
  must_change_password: Boolean(user.must_change_password),
});

const createSession = (user: any) => {
  const factory = factoryFromAccount(user);
  if (!factory) throw new AppError(403, "FACTORY_MEMBERSHIP_REQUIRED", "Votre compte doit être rattaché à une usine par un administrateur.");
  const token = jwt.sign(
    { email: user.email, tv: Number(user.token_version ?? 0), ...factory },
    env.jwtSecret,
    { subject: user.id, expiresIn: env.jwtExpiresInSeconds },
  );

  return {
    access_token: token,
    token_type: "bearer",
    expires_in: env.jwtExpiresInSeconds,
    user: toPublicUser(user),
  };
};

@Injectable()
export class AuthService {
  async signIn(payload: { email: string; password: string }) {
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");

    const user = await AuthUserModel.findOne({ email, is_active: true }).lean().exec();
    if (!user) throw unauthorized("Invalid email or password.");

    const storedPasswordHash = getStoredPasswordHash(user);
    if (!storedPasswordHash) throw unauthorized("Invalid email or password.");

    const matches = await bcrypt.compare(password, storedPasswordHash);
    if (!matches) throw unauthorized("Invalid email or password.");

    if (!user.passwordHash) {
      await AuthUserModel.updateOne(
        { id: user.id },
        { $set: { passwordHash: storedPasswordHash, updated_at: nowIso() } },
      ).exec();
    }

    return createSession(user);
  }

  async getSession(auth: any) {
    if (!auth?.user?.id) return { session: null, user: null };

    const user = await AuthUserModel.findOne({ id: auth.user.id, is_active: true }).lean().exec();
    if (!user) return { session: null, user: null };
    if (!sameFactory(auth.factory, factoryFromAccount(user))) return { session: null, user: null };

    return { session: createSession(user), user: toPublicUser(user) };
  }

  /** Ends every other session for this account and returns a fresh one. */
  async changePassword(auth: any, payload: { current_password?: string; new_password?: string }) {
    if (!auth?.user?.id) throw unauthorized("Authentication required.");
    const currentPassword = String(payload.current_password || "");
    const newPassword = String(payload.new_password || "");

    const user = await AuthUserModel.findOne({ id: auth.user.id, is_active: true }).lean().exec();
    if (!user) throw unauthorized("Authentication required.");

    const storedPasswordHash = getStoredPasswordHash(user);
    if (!storedPasswordHash || !(await bcrypt.compare(currentPassword, storedPasswordHash))) {
      throw unauthorized("Mot de passe incorrect.");
    }
    assertPasswordStrength(newPassword);
    if (newPassword === currentPassword) {
      throw badRequest("PASSWORD_UNCHANGED", "Choisissez un mot de passe différent de l'actuel.");
    }

    await AuthUserModel.updateOne(
      { id: user.id },
      {
        $set: { passwordHash: await bcrypt.hash(newPassword, 10), must_change_password: false, updated_at: nowIso() },
        $inc: { token_version: 1 },
      },
    ).exec();
    invalidateAuthCache(user.id);

    return createSession({
      ...user,
      must_change_password: false,
      token_version: Number(user.token_version ?? 0) + 1,
    });
  }

  async logout(auth: any) {
    if (!auth?.user?.id) return;
    await AuthUserModel.updateOne({ id: auth.user.id }, { $inc: { token_version: 1 } }).exec();
    invalidateAuthCache(auth.user.id);
  }

  /** Set or rotate the logged-in user's numeric signature PIN (requires password). */
  async setOwnSignaturePin(auth: any, payload: { pin?: string; password?: string }) {
    if (!auth?.user?.id) throw unauthorized("Authentication required.");
    const pin = String(payload.pin || "").trim();
    const password = String(payload.password || "");

    const user = await AuthUserModel.findOne({ id: auth.user.id, is_active: true }).lean().exec();
    if (!user) throw unauthorized("Authentication required.");

    const storedPasswordHash = getStoredPasswordHash(user);
    if (!storedPasswordHash || !(await bcrypt.compare(password, storedPasswordHash))) {
      throw unauthorized("Mot de passe incorrect.");
    }

    return setUserSignaturePin(auth.user.id, pin);
  }

  async clearOwnSignaturePin(auth: any, payload: { password?: string }) {
    if (!auth?.user?.id) throw unauthorized("Authentication required.");
    const password = String(payload.password || "");

    const user = await AuthUserModel.findOne({ id: auth.user.id, is_active: true }).lean().exec();
    if (!user) throw unauthorized("Authentication required.");

    const storedPasswordHash = getStoredPasswordHash(user);
    if (!storedPasswordHash || !(await bcrypt.compare(password, storedPasswordHash))) {
      throw unauthorized("Mot de passe incorrect.");
    }

    return clearUserSignaturePin(auth.user.id);
  }
}

export const authService = new AuthService();
