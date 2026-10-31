import axios from "axios";
import { resolveApiBaseUrl } from "./apiTarget";

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
const AUTH_STORAGE_KEY = "date-harvest-hub-session";

export const SESSION_ENDED_EVENT = "auth:session-ended";

/** A wrong PIN or password is also a 401; only the route guard sends this code. */
export const isSessionEnded = (status: number | undefined, code: string | undefined) =>
  status === 401 && code === "SESSION_REQUIRED";

const readStoredToken = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null")?.access_token ?? null;
  } catch {
    return null;
  }
};

export class ApiRequestError extends Error {
  status: number | null;
  code: string | null;
  isNetworkError: boolean;
  details: unknown;

  constructor(input: {
    message: string;
    status?: number | null;
    code?: string | null;
    isNetworkError?: boolean;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "ApiRequestError";
    this.status = input.status ?? null;
    this.code = input.code ?? null;
    this.isNetworkError = input.isNetworkError ?? false;
    this.details = input.details;
  }
}

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

axiosClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
  } catch {
    // ignore parse errors
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    // A slow reply to an old token must not sign out a session opened since.
    const token = readStoredToken();
    if (
      isSessionEnded(error.response?.status, data?.error?.code) &&
      token && error.config?.headers?.Authorization === `Bearer ${token}`
    ) {
      window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
    }
    const message =
      data?.error?.message ||
      (error.response?.status === 403
        ? "You do not have permission to perform this action."
        : `Request failed: ${error.response?.status ?? "network error"}`);
    throw new ApiRequestError({
      message,
      status: error.response?.status ?? null,
      code: data?.error?.code ?? error.code ?? null,
      isNetworkError: !error.response,
      details: data?.error?.details,
    });
  },
);
