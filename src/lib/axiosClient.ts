import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://focused-illumination-production-d6a5.up.railway.app/api"
    : "/api");
const AUTH_STORAGE_KEY = "date-harvest-hub-session";

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
    const message =
      data?.error?.message ||
      (error.response?.status === 403
        ? "You do not have permission to perform this action."
        : `Request failed: ${error.response?.status ?? "network error"}`);
    throw new Error(message);
  },
);
