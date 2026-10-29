/**
 * CheckPalletGarate - Contratos de tipos TypeScript
 * Alineados con la API REST Laravel 12 (prefix: /api/v1)
 */

// ─── Autenticación ────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  /** Formato devuelto por Sanctum: "1|abcDEF..." o "Bearer 1|abc..." */
  token: string;
  user: User;
}

// ─── Catálogos / Ficha técnica ────────────────────────────────────

export interface Material {
  id: number;
  nombre: string;
}

export interface Packaging {
  id: number;
  nombre: string;
}

export interface PalletItem {
  id: number;
  cantidad_estandar: number;
  calibre: string | null;
  material: Material;
  replacement_material: Material | null;
}

export interface Paletizaje {
  base_pallet: string | null;
  filas_cajas: string | null;
  tiempo_viaje: string | null;
  altura_pallet: string | null;
  instrucciones: string | null;
  metros_zuncho: string | null;
  protocolo_sag: string | null;
  sellos_zuncho: string | null;
  tipo_transporte: string | null;
  cajas_por_pallet: string | null;
  zunchos_verticales_lado_1m: string | null;
  numero_zunchos_horizontales: string | null;
  zunchos_verticales_lado_1_2m: string | null;
  posiciones_zunchos_horizontales: string | null;
}

export interface TechnicalSheet {
  id: number;
  nombre: string;
  version: string | number;
  packaging: Packaging;
  /** Metadatos de la ficha: contiene `packaging_spec` con calidades,
   *  formato, paletizaje, tolerancias, responsables e identificación. */
  metadata?: {
    packaging_spec?: {
      paletizaje?: Paletizaje | null;
      [seccion: string]: unknown;
    } | null;
    [clave: string]: unknown;
  } | null;
  paletizaje?: Paletizaje | null;
  items?: unknown[];
  unit_items?: unknown[];
  pallet_items: PalletItem[];
}

/** Respuesta de GET /api/v1/pallets/{folio}
 *  El backend puede devolver la ficha en `sheet` o en `technical_sheet`. */
export interface PalletResponse {
  folio: string;
  c_embalaje?: string;
  technical_sheet_id?: number;
  sheet?: TechnicalSheet;
  technical_sheet?: TechnicalSheet;
  metadata?: unknown;
}

// ─── Inspección ───────────────────────────────────────────────────

/** Ítem individual del payload de inspección */
export interface InspectionItemPayload {
  technical_sheet_pallet_item_id: number;
  material_utilizado_id: number;
  es_reemplazo: boolean;
  cumple: boolean;
  motivo_no_cumple: string | null;
}

/** Body de POST /api/v1/inspections */
export interface PaletizajeCheckPayload {
  campo: string;
  valor_esperado: string;
  cumple: boolean;
  motivo_no_cumple: string | null;
}

export interface InspectionPayload {
  folio: string;
  technical_sheet_id: number;
  observaciones_generales: string;
  items: InspectionItemPayload[];
  paletizaje_checks: PaletizajeCheckPayload[];
}

export type InspectionResultado = 'aprobado' | 'rechazado';

/** Respuesta de POST /api/v1/inspections (201) */
export interface InspectionResponse {
  message: string;
  resultado: InspectionResultado;
  inspection_id: number;
}

// ─── Estado local del checklist (UI) ──────────────────────────────

export type ChecklistDecision = 'cumple' | 'no_cumple' | null;

/** Verificación concreta derivada del nodo `paletizaje`. */
export interface PaletizajeCheck {
  key: string;
  label: string;
  value: string;
  unit: string | null;
}

/** Estado de un ítem en el checklist mientras el operario lo completa */
export interface ChecklistItemState {
  check: PaletizajeCheck;
  decision: ChecklistDecision;
  motivoNoCumple: string;
}
