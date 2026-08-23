/**
 * Multi-manufacturer mail transport.
 * Branding comes from site_settings (company_name / plant_* / colors).
 * SMTP secrets stay in env so the same codebase serves Royale Palm, EcoDatte, Bioscha, etc.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export type MailBrand = {
  companyName: string;
  companyShortName?: string | null;
  plantName?: string | null;
  plantAddress?: string | null;
  plantPhone?: string | null;
  plantEmail?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  currency?: string | null;
  siteCode?: string | null;
};

export type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  tags?: string[];
  /** When true, skip send if SMTP is not configured (still returns skipped). */
  softFail?: boolean;
};

export type SendMailResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string | null;
  mode: "smtp" | "console" | "disabled";
};

let cachedTransport: Transporter | null | undefined;

const readEnv = (key: string) => String(process.env[key] || "").trim();

export const isSmtpConfigured = () => {
  const host = readEnv("SMTP_HOST");
  const from = readEnv("SMTP_FROM") || readEnv("MAIL_FROM");
  return Boolean(host && from);
};

export const getMailFromAddress = () =>
  readEnv("SMTP_FROM") || readEnv("MAIL_FROM") || "noreply@localhost";

const getTransport = (): Transporter | null => {
  if (cachedTransport !== undefined) return cachedTransport;

  const host = readEnv("SMTP_HOST");
  if (!host) {
    cachedTransport = null;
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
  return cachedTransport;
};

/** Test-only: clear transporter cache. */
export const resetMailTransportForTests = () => {
  cachedTransport = undefined;
};

export const sendMail = async (input: SendMailInput): Promise<SendMailResult> => {
  const toList = (Array.isArray(input.to) ? input.to : [input.to])
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (toList.length === 0) {
    return { ok: false, skipped: true, reason: "NO_RECIPIENT", mode: "disabled", messageId: null };
  }

  const from = getMailFromAddress();
  const transport = getTransport();

  if (!transport) {
    const allowConsole =
      String(process.env.MAIL_CONSOLE_FALLBACK || "true").toLowerCase() !== "false";
    if (allowConsole) {
      console.info("[mail:console]", {
        to: toList,
        subject: input.subject,
        tags: input.tags || [],
        text: input.text.slice(0, 500),
      });
      return {
        ok: true,
        skipped: false,
        reason: "CONSOLE_FALLBACK",
        mode: "console",
        messageId: `console-${Date.now()}`,
      };
    }
    return {
      ok: false,
      skipped: true,
      reason: "SMTP_NOT_CONFIGURED",
      mode: "disabled",
      messageId: null,
    };
  }

  try {
    const info = await transport.sendMail({
      from,
      to: toList.join(", "),
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo || undefined,
      headers: input.tags?.length
        ? { "X-MES-Tags": input.tags.join(",") }
        : undefined,
    });
    return {
      ok: true,
      mode: "smtp",
      messageId: String(info.messageId || "") || null,
    };
  } catch (error) {
    console.error("[mail] send failed:", error);
    if (input.softFail) {
      return {
        ok: false,
        skipped: true,
        reason: error instanceof Error ? error.message : "SEND_FAILED",
        mode: "smtp",
        messageId: null,
      };
    }
    throw error;
  }
};

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
