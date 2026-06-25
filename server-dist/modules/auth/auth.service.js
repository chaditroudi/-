var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { conflict, unauthorized } from "../../core/app-error.js";
import { sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel } from "../../db/dynamic-model.js";
import { AuthUserModel } from "../../models/auth-user.model.js";
const nowIso = () => new Date().toISOString();
const getStoredPasswordHash = (user) => {
    if (typeof user?.passwordHash === "string" && user.passwordHash.length > 0)
        return user.passwordHash;
    if (typeof user?.password_hash === "string" && user.password_hash.length > 0)
        return user.password_hash;
    return null;
};
const toPublicUser = (user) => ({
    id: user.id,
    email: user.email,
    user_metadata: sanitizeDocument(user.user_metadata || {}),
});
const createSession = (user) => {
    const token = jwt.sign({ email: user.email, user_metadata: user.user_metadata || {} }, env.jwtSecret, { subject: user.id, expiresIn: env.jwtExpiresInSeconds });
    return {
        access_token: token,
        token_type: "bearer",
        expires_in: env.jwtExpiresInSeconds,
        user: toPublicUser(user),
    };
};
let AuthService = class AuthService {
    async signUp(payload) {
        const email = String(payload.email || "").trim().toLowerCase();
        const password = String(payload.password || "");
        const metadata = sanitizeDocument(payload.options?.data || {});
        const existingUser = await AuthUserModel.findOne({ email }).lean().exec();
        if (existingUser)
            throw conflict("AUTH_EMAIL_EXISTS", "An account already exists with this email.");
        const role = String(metadata.role || "").trim();
        const roles = Array.isArray(metadata.roles) && metadata.roles.length > 0
            ? metadata.roles
            : role ? [role] : ["operateur"];
        const now = nowIso();
        const user = await AuthUserModel.create({
            id: randomUUID(),
            email,
            passwordHash: await bcrypt.hash(password, 10),
            user_metadata: { ...metadata, roles },
            is_active: true,
            created_at: now,
            updated_at: now,
        });
        const profilesCollection = getCollectionModel("profiles");
        const userRolesCollection = getCollectionModel("user_roles");
        const profile = await prepareInsertDocument("profiles", {
            user_id: user.id,
            email,
            full_name: metadata.full_name || email.split("@")[0],
            avatar_url: metadata.avatar_url || null,
            phone: metadata.phone || null,
        });
        await profilesCollection.create([profile]);
        const userRoles = await Promise.all(roles.map((assignedRole) => prepareInsertDocument("user_roles", { user_id: user.id, role: assignedRole, assigned_by: null })));
        if (userRoles.length > 0)
            await userRolesCollection.create(userRoles);
        return { user: toPublicUser(user), session: null };
    }
    async signIn(payload) {
        const email = String(payload.email || "").trim().toLowerCase();
        const password = String(payload.password || "");
        const user = await AuthUserModel.findOne({ email, is_active: true }).lean().exec();
        if (!user)
            throw unauthorized("Invalid email or password.");
        const storedPasswordHash = getStoredPasswordHash(user);
        if (!storedPasswordHash)
            throw unauthorized("Invalid email or password.");
        const matches = await bcrypt.compare(password, storedPasswordHash);
        if (!matches)
            throw unauthorized("Invalid email or password.");
        if (!user.passwordHash) {
            await AuthUserModel.updateOne({ id: user.id }, { $set: { passwordHash: storedPasswordHash, updated_at: nowIso() } }).exec();
        }
        return createSession(user);
    }
    async getSession(auth) {
        if (!auth?.user?.id)
            return { session: null, user: null };
        const user = await AuthUserModel.findOne({ id: auth.user.id, is_active: true }).lean().exec();
        if (!user)
            return { session: null, user: null };
        return { session: createSession(user), user: toPublicUser(user) };
    }
};
AuthService = __decorate([
    Injectable()
], AuthService);
export { AuthService };
export const authService = new AuthService();
