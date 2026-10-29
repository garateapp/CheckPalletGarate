/**
 * Extracción y normalización del nodo `paletizaje` de la ficha técnica.
 * El bloque puede venir anidado en distintas secciones (p. ej.
 * `sheet.metadata.packaging_spec.paletizaje`), por lo que se busca
 * recursivamente la primera clave `paletizaje` con datos útiles.
 */
import type { Paletizaje, PaletizajeCheck, PalletResponse, TechnicalSheet } from '../types';

interface FieldDefinition {
  key: keyof Paletizaje;
  label: string;
  unit: string | null;
}

export const PALETIZAJE_FIELDS: FieldDefinition[] = [
  { key: 'base_pallet', label: 'Cajas en la base del pallet', unit: 'cajas' },
  { key: 'filas_cajas', label: 'Filas de cajas', unit: 'filas' },
  { key: 'cajas_por_pallet', label: 'Cajas por pallet', unit: 'cajas' },
  { key: 'altura_pallet', label: 'Altura del pallet', unit: 'm' },
  { key: 'tipo_transporte', label: 'Tipo de transporte', unit: null },
  { key: 'tiempo_viaje', label: 'Tiempo de viaje', unit: null },
  { key: 'metros_zuncho', label: 'Metros de zuncho', unit: 'm' },
  { key: 'numero_zunchos_horizontales', label: 'Zunchos horizontales', unit: 'zunchos' },
  {
    key: 'posiciones_zunchos_horizontales',
    label: 'Posiciones de zunchos horizontales',
    unit: null,
  },
  {
    key: 'zunchos_verticales_lado_1m',
    label: 'Zunchos verticales (lado 1 m)',
    unit: 'zunchos',
  },
  {
    key: 'zunchos_verticales_lado_1_2m',
    label: 'Zunchos verticales (lado 1,2 m)',
    unit: 'zunchos',
  },
  { key: 'sellos_zuncho', label: 'Sellos de zuncho', unit: null },
  { key: 'protocolo_sag', label: 'Protocolo SAG', unit: null },
  { key: 'instrucciones', label: 'Instrucciones', unit: null },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function findPaletizaje(source: unknown): Paletizaje | null {
  const visited = new Set<object>();

  function visit(node: unknown): Paletizaje | null {
    if (typeof node !== 'object' || node === null || visited.has(node)) {
      return null;
    }
    visited.add(node);

    if (Array.isArray(node)) {
      for (const entry of node) {
        const found = visit(entry);
        if (found) return found;
      }
      return null;
    }

    if (!isRecord(node)) return null;

    const candidate = node.paletizaje;
    if (isRecord(candidate)) {
      const paletizaje = candidate as unknown as Paletizaje;
      if (buildPaletizajeChecks(paletizaje).length > 0) {
        return paletizaje;
      }
    }

    for (const value of Object.values(node)) {
      const found = visit(value);
      if (found) return found;
    }

    return null;
  }

  return visit(source);
}

export function buildPaletizajeChecks(paletizaje: Paletizaje): PaletizajeCheck[] {
  const checks: PaletizajeCheck[] = [];

  for (const field of PALETIZAJE_FIELDS) {
    const rawValue = paletizaje[field.key];
    if (rawValue === null || rawValue === undefined) continue;

    const value = String(rawValue).trim();
    if (!value) continue;

    checks.push({
      key: field.key,
      label: field.label,
      value,
      unit: field.unit,
    });
  }

  return checks;
}

export function extractPaletizajeChecks(source: unknown): PaletizajeCheck[] {
  const paletizaje = findPaletizaje(source);

  return paletizaje ? buildPaletizajeChecks(paletizaje) : [];
}

/**
 * Obtiene la ficha técnica del pallet sin importar si el backend la envió
 * como `sheet` o como `technical_sheet`.
 */
export function getSheetFromPallet(pallet: PalletResponse): TechnicalSheet {
  const sheet = pallet.sheet ?? pallet.technical_sheet;
  if (!sheet) {
    throw new Error('La respuesta del servidor no incluye ficha técnica.');
  }
  return sheet;
}
