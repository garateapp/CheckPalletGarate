/**
 * CheckPalletGarate - Cliente HTTP centralizado (Axios)
 *
 * - URL base configurable vía APP_V1_API_URL (app.config / .env con expo-constants).
 * - Interceptor de solicitud: inyecta automáticamente el Bearer Token
 *   persistido en expo-secure-store.
 * - Interceptor de respuesta: manejo centralizado de errores; ante 401
 *   limpia el token y notifica a la app para redirigir al login.
 */
import axios, { AxiosError, AxiosHeaders } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type {
  InspectionPayload,
  InspectionResponse,
  LoginRequest,
  LoginResponse,
  PalletResponse,
} from '../types';

// ─── Constantes ───────────────────────────────────────────────────

export const TOKEN_STORAGE_KEY = 'user_token';
export const USER_STORAGE_KEY = 'user_profile';

/**
 * Resolución de la URL base, en orden de prioridad:
 * 1. extra.apiUrl en app.json / app.config.ts
 * 2. Variable de entorno APP_V1_API_URL (babel-plugin-transform-inline-environment-variables o app.config dinámico)
 * 3. Fallback de desarrollo (emulador Android -> host local)
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
const envUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL: string =
  extra.apiUrl ?? envUrl ?? 'https://appgreenex.cl/api/v1';

// ─── Callback de expiración (desacople con el contexto de auth) ───

let onUnauthorized: (() => void) | null = null;

/**
 * Permite que AuthContext registre un listener para cuando el backend
 * responda 401 (token expirado/inválido) y la app regrese al login.
 */
export function setOnUnauthorized(callback: (() => void) | null): void {
  onUnauthorized = callback;
}

// ─── Normalización del token ──────────────────────────────────────

/**
 * Sanctum puede devolver "1|abc..." o "Bearer 1|abc...".
 * Guardamos siempre el valor limpio para armar "Bearer <token>" sin duplicados.
 */
export function normalizeToken(rawToken: string): string {
  return rawToken.replace(/^Bearer\s+/i, '').trim();
}

// ─── Instancia Axios ──────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Inyectar el Bearer Token desde SecureStore en cada request.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${normalizeToken(token)}`);
    config.headers = headers;
  }
  return config;
});

// Manejo centralizado de errores.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;

    if (status === 401) {
      // Token expirado o inválido: limpiar sesión persistida y avisar.
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY),
        SecureStore.deleteItemAsync(USER_STORAGE_KEY),
      ]);
      onUnauthorized?.();
    }

    const message =
      status === 401
        ? 'Tu sesión ha expirado. Vuelve a iniciar sesión.'
        : status === 404
          ? 'Registro no encontrado. Verifica el folio escaneado.'
          : error.code === 'ECONNABORTED'
            ? 'Tiempo de espera agotado. Revisa tu conexión.'
            : !error.response
              ? 'Sin conexión con el servidor. Verifica la red Wi-Fi industrial.'
              : (error.response?.data?.message ?? 'Error inesperado del servidor.');

    return Promise.reject(new Error(message));
  }
);

// ─── Endpoints tipados ────────────────────────────────────────────

export async function login(request: LoginRequest): Promise<LoginResponse> {
  console.log('login request', request);
  const { data } = await api.post<LoginResponse>('/auth/login', request);
  return data;
}

/**
 * Normaliza la respuesta de GET /pallets/{folio}.
 * El backend puede devolver la ficha dentro de `sheet` o `technical_sheet`,
 * y/o envolver todo en `{ data: ... }`. Se garantiza siempre `technical_sheet`.
 */
export function normalizePalletResponse(raw: unknown): PalletResponse | null {
  if (!raw || typeof raw !== 'object') return null;

  let source = raw as Record<string, unknown>;

  // Si viene envuelto en { data: {...} }, desenvolver.
  if ('data' in source && source.data && typeof source.data === 'object' && !('sheet' in source.data) && !('technical_sheet' in source.data)) {
    source = { ...source, ...(source.data as Record<string, unknown>) };
  } else if ('data' in source && source.data && typeof source.data === 'object') {
    source = { ...source, ...(source.data as Record<string, unknown>) };
  }

  const sheet = (source.sheet ?? source.technical_sheet) as PalletResponse['technical_sheet'] | undefined;
  const folio = source.folio != null ? String(source.folio) : '';

  if (!sheet || typeof sheet !== 'object') return null;

  return {
    ...source,
    folio,
    technical_sheet: sheet,
    sheet,
    metadata: source.metadata,
  } as PalletResponse;
}

export async function fetchPallet(folio: string): Promise<PalletResponse> {
  const { data } = await api.get<unknown>(
    `/pallets/${encodeURIComponent(folio.trim())}`
  );

  const normalized = normalizePalletResponse(data);
  if (!normalized || !normalized.technical_sheet) {
    throw new Error('Respuesta inesperada del servidor: sin ficha técnica.');
  }
  return normalized;
}

export async function sendInspection(
  payload: InspectionPayload
): Promise<InspectionResponse> {
  const { data } = await api.post<InspectionResponse>('/inspections', payload);
  return data;
}

export async function logoutRequest(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // El cierre de sesión local es obligatorio aunque el backend falle.
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
  }
}
