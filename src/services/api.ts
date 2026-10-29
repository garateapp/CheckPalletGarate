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
 * El backend serializa `sheet.metadata` como string JSON (o lo omite cuando
 * la ficha no tiene packaging_spec). Lo convertimos a objeto para que el
 * checklist pueda leer `metadata.packaging_spec.paletizaje`.
 */
function parseSheetMetadata(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      console.warn('[normalizePalletResponse] metadata no es JSON válido:', value.slice(0, 120));
      return null;
    }
  }
  return null;
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
  if ('data' in source && source.data && typeof source.data === 'object') {
    source = { ...source, ...(source.data as Record<string, unknown>) };
  }

  const sheet = (source.sheet ?? source.technical_sheet) as
    | (PalletResponse['technical_sheet'] & { metadata?: unknown })
    | undefined;
  const folio = source.folio != null ? String(source.folio) : '';

  if (!sheet || typeof sheet !== 'object') return null;

  // El backend serializa la metadata de la ficha como string JSON (o la omite).
  // La convertimos a objeto para poder leer `metadata.packaging_spec.paletizaje`.
  const sheetMeta = parseSheetMetadata(sheet.metadata);
  // Metadata a nivel raíz o nivel ficha (algunos backends la ponen fuera del sheet).
  const rootMeta = parseSheetMetadata(source.metadata) ?? parseSheetMetadata(source.sheet_metadata);

  const normalized: PalletResponse = {
    ...source,
    folio,
    technical_sheet: sheet,
    sheet,
  };

  if (sheetMeta) {
    sheet.metadata = sheetMeta;
  } else if (!sheet.metadata && rootMeta) {
    // Fallback: la ficha no trae metadata pero el nivel raíz sí → copiarla.
    sheet.metadata = rootMeta;
  }

  if (!sheet.metadata) {
    console.warn(
      '[normalizePalletResponse] La ficha NO incluye metadata/packaging_spec. Claves sheet:',
      Object.keys(sheet).join(','),
      '| Claves raíz:',
      Object.keys(source).join(',')
    );
  } else {
    const spec = (sheet.metadata as Record<string, unknown>)?.packaging_spec as
      | Record<string, unknown>
      | undefined;
    console.log(
      '[normalizePalletResponse] metadata OK. Secciones packaging_spec:',
      spec ? Object.keys(spec).join(',') : '(sin packaging_spec)'
    );
  }

  return normalized;
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
  try {
    const { data } = await api.post<InspectionResponse>('/inspections', payload);
    return data;
  } catch (error) {
    // 422 de StorePalletInspectionRequest: convertir los errores de validación
    // en un mensaje legible para el operario.
    if (axios.isAxiosError(error) && error.response?.status === 422) {
      const body = error.response.data as
        | { message?: string; errors?: Record<string, string[]> }
        | undefined;
      const details = body?.errors
        ? Object.entries(body.errors)
            .map(([field, msgs]) => `• ${field}: ${msgs.join(', ')}`)
            .join('\n')
        : '';
      throw new Error(
        ['Datos incompletos para guardar la inspección.', details]
          .filter(Boolean)
          .join('\n')
      );
    }
    throw error;
  }
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
