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

export interface TechnicalSheet {
  id: number;
  nombre: string;
  version: string;
  packaging: Packaging;
  pallet_items: PalletItem[];
}

/** Respuesta de GET /api/v1/pallets/{folio} */
export interface PalletResponse {
  folio: string;
  technical_sheet: TechnicalSheet;
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
export interface InspectionPayload {
  folio: string;
  technical_sheet_id: number;
  observaciones_generales: string;
  items: InspectionItemPayload[];
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

/** Estado de un ítem en el checklist mientras el operario lo completa */
export interface ChecklistItemState {
  palletItem: PalletItem;
  /** true si el operario seleccionó el material de reemplazo */
  usingReplacement: boolean;
  decision: ChecklistDecision;
  motivoNoCumple: string;
}
