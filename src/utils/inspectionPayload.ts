/**
 * Construcción del body de POST /api/v1/inspections.
 *
 * Alineado 1:1 con lo que consume el controlador Laravel:
 *   $validated['folio']                       → string
 *   $validated['c_embalaje']                  → string
 *   $validated['technical_sheet_id']          → int
 *   $validated['items']                       → array (required, min:1)
 *      items[].technical_sheet_pallet_item_id → id de sheet.pallet_items[].id
 *      items[].material_utilizado_id          → id del material efectivamente usado
 *      items[].es_reemplazo                  → bool
 *      items[].cumple                        → bool
 *      items[].motivo_no_cumple              → string|null
 *   $validated['observaciones_generales']     → string|null (nullable en el server)
 *
 * IMPORTANTE: el resultado (`aprobado`/`rechazado`) lo calcula el SERVIDOR como
 * `collect($validated['items'])->every(fn => cumple)`. Por eso, si el operario
 * marca "No Cumple" en alguna verificación de PALETIZAJE, se añade un ítem
 * sintético al array `items` para que ese incumplimiento también afecte el
 * resultado; de lo contrario el pallet quedaría "aprobado" aunque el paletizaje
 * falle.
 */
import type {
  ChecklistItemState,
  InspectionPayload,
  PaletizajeCheckPayload,
  PalletItem,
  PalletItemCheckPayload,
  PalletResponse,
  TechnicalSheet,
} from '../types';
import { getValidPalletItems } from '../types';

export class InspectionPayloadError extends Error {}

/** Id de la ficha: raíz de la respuesta o dentro del sheet. */
function resolveTechnicalSheetId(
  pallet: PalletResponse,
  sheet: TechnicalSheet
): number | null {
  const candidates = [
    pallet.technical_sheet_id,
    (pallet as unknown as Record<string, unknown>).sheet_id,
    sheet.id,
    (sheet as unknown as Record<string, unknown>).technical_sheet_id,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

/** Código de embalaje: raíz, sheet.packaging.codigo o el folio consultado. */
function resolveCEmbalaje(pallet: PalletResponse, sheet: TechnicalSheet): string {
  const root = (pallet as unknown as Record<string, unknown>).c_embalaje;
  if (typeof root === 'string' && root.trim()) return root.trim();

  const codigo: unknown = sheet.packaging?.codigo ?? (sheet as unknown as Record<string, unknown>).codigo;
  if (typeof codigo === 'string' && codigo.trim()) return codigo.trim();

  return pallet.folio ?? '';
}

/** Material realmente utilizado: reemplazo si existe, si no el principal. */
function resolveMaterialUtilizadoId(item: PalletItem): number | null {
  const replacementId = Number(item.replacement_material_id);
  if (Number.isFinite(replacementId) && replacementId > 0) return replacementId;

  const materialId = Number(item.material_id ?? item.material?.id);
  if (Number.isFinite(materialId) && materialId > 0) return materialId;

  return null;
}

function describeItem(item: PalletItem): string {
  const nombre = item.material?.nombre ?? 'Material';
  const codigo = item.material?.codigo ? ` (${item.material.codigo})` : '';
  const cantidad = String(item.cantidad_estandar ?? '').trim();
  return `${nombre}${codigo}${cantidad ? ` · ${cantidad}` : ''}`;
}

export interface BuildParams {
  pallet: PalletResponse;
  sheet: TechnicalSheet;
  /** Decisiones del checklist de paletizaje (nodo metadata.packaging_spec.paletizaje). */
  paletizajeStates: ChecklistItemState[];
  observacionesGenerales: string;
  /**
   * Decisiones por material de pallet_items. Si no se informa una decisión
   * explícita para un ítem, se asume `cumple: true` (el checklist visible es
   * el de paletizaje; los materiales se registran como conformes salvo
   * indicación contraria vía observaciones).
   */
  materialStates?: Array<{ itemId: number; decision: 'cumple' | 'no_cumple'; motivo: string }>;
}

export function buildInspectionPayload({
  pallet,
  sheet,
  paletizajeStates,
  observacionesGenerales,
  materialStates = [],
}: BuildParams): InspectionPayload {
  const folio = String(pallet.folio ?? '').trim();
  if (!folio) throw new InspectionPayloadError('Falta el folio del pallet.');

  const technicalSheetId = resolveTechnicalSheetId(pallet, sheet);
  if (technicalSheetId === null) {
    throw new InspectionPayloadError('La ficha técnica no tiene ID válido.');
  }

  const cEmbalaje = resolveCEmbalaje(pallet, sheet);
  if (!cEmbalaje) {
    throw new InspectionPayloadError('No se pudo determinar el código de embalaje (c_embalaje).');
  }

  const validItems = getValidPalletItems(sheet);
  if (validItems.length === 0) {
    throw new InspectionPayloadError(
      'La ficha técnica no trae pallet_items; el servidor exige al menos un ítem.'
    );
  }

  // ── items[] desde pallet_items de la ficha ────────────────────────
  const stateByItemId = new Map(materialStates.map((s) => [s.itemId, s]));
  const items: PalletItemCheckPayload[] = [];

  for (const item of validItems) {
    const materialUtilizadoId = resolveMaterialUtilizadoId(item);
    if (materialUtilizadoId === null) continue; // sin material no hay fila válida

    const state = stateByItemId.get(item.id);
    const cumple = state ? state.decision === 'cumple' : true;
    const motivo = !cumple && state ? state.motivo.trim() || 'Material no conforme' : null;

    items.push({
      technical_sheet_pallet_item_id: item.id,
      material_utilizado_id: materialUtilizadoId,
      es_reemplazo:
        Number(item.replacement_material_id) > 0 &&
        materialUtilizadoId === Number(item.replacement_material_id),
      cumple,
      motivo_no_cumple: motivo,
      descripcion: describeItem(item),
    });
  }

  if (items.length === 0) {
    throw new InspectionPayloadError(
      'Ningún pallet_item de la ficha tiene material válido para registrar.'
    );
  }

  // ── paletizaje_checks[] (informativos + driver del resultado) ─────
  const paletizajeChecks = paletizajeStates.map<PaletizajeCheckPayload>((state) => ({
    campo: state.check.key,
    valor_esperado: state.check.unit
      ? `${state.check.value} ${state.check.unit}`
      : state.check.value,
    cumple: state.decision === 'cumple',
    motivo_no_cumple:
      state.decision === 'no_cumple' ? state.motivoNoCumple.trim() || 'No conforme' : null,
  }));

  // Cada verificación de paletizaje NO conforme se refleja como un ítem
  // adicional para que el cálculo de `resultado` del servidor sea correcto.
  for (const check of paletizajeChecks) {
    if (check.cumple) continue;
    items.push({
      technical_sheet_pallet_item_id: validItems[0].id,
      material_utilizado_id: resolveMaterialUtilizadoId(validItems[0]) ?? validItems[0].material_id,
      es_reemplazo: false,
      cumple: false,
      motivo_no_cumple: `${check.campo}: ${check.motivo_no_cumple ?? 'No conforme'} (esperado ${check.valor_esperado})`,
      descripcion: `Paletizaje · ${check.campo}`,
    });
  }

  const observaciones = observacionesGenerales.trim();

  return {
    folio,
    c_embalaje: cEmbalaje,
    technical_sheet_id: technicalSheetId,
    observaciones_generales: observaciones ? observaciones : null,
    items,
    paletizaje_checks: paletizajeChecks,
  };
}
