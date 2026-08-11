import axios from 'axios';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const ACCESS_KEY = 'gs_access';
const REFRESH_KEY = 'gs_refresh';

export const tokens = {
  get access() {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set({ access, refresh }) {
    if (typeof window === 'undefined') return;
    if (access) window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = tokens.access;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    if (status !== 401 || original.__retried || !tokens.refresh) {
      return Promise.reject(error);
    }

    original.__retried = true;
    try {
      refreshing =
        refreshing ||
        axios.post(`${API_URL}/api/v1/auth/token/refresh/`, {
          refresh: tokens.refresh,
        });
      const { data } = await refreshing;
      refreshing = null;
      tokens.set({ access: data.access, refresh: data.refresh });
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (refreshError) {
      refreshing = null;
      tokens.clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return Promise.reject(refreshError);
    }
  }
);

export function apiError(error, fallback = 'Something went wrong') {
  const data = error?.response?.data;
  if (!data) return error?.message || fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const first = Object.entries(data)[0];
  if (!first) return fallback;
  const [field, value] = first;
  const message = Array.isArray(value) ? value[0] : value;
  return field === 'non_field_errors' ? message : `${field}: ${message}`;
}

export default api;
