/**
 * CheckPalletGarate - Pantalla de checklist de conformación
 *
 * - Cabecera con Folio, Nombre de la Ficha, Versión y Packaging.
 * - Checklist generado exclusivamente desde el nodo `paletizaje` de la ficha.
 * - Validación binaria estricta: [ ✓ Cumple ] / [ ✕ No Cumple ].
 * - "No Cumple" despliega TextInput obligatorio de motivo.
 * - Observaciones generales opcionales.
 * - Botón "Finalizar Inspección" inactivo hasta completar el 100 %.
 * - POST /api/v1/inspections → Alert con APROBADO/RECHAZADO → vuelve a Scan.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sendInspection } from '../services/api';
import type {
  ChecklistItemState,
  InspectionPayload,
  PaletizajeCheckPayload,
} from '../types';
import { extractPaletizajeChecks } from '../utils/paletizaje';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, TOUCH_TARGET_HEIGHT } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Checklist'>;

export default function ChecklistScreen({ route, navigation }: Props): React.JSX.Element {
  const { pallet } = route.params;
  const sheet = pallet.technical_sheet;

  // ─── Estado del checklist ───────────────────────────────────────
  const [items, setItems] = useState<ChecklistItemState[]>(() =>
    extractPaletizajeChecks(pallet).map((check) => ({
      check,
      decision: null,
      motivoNoCumple: '',
    }))
  );
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Bloqueo anti doble envío. */
  const [submitLock, setSubmitLock] = useState(false);

  const updateItem = useCallback(
    (index: number, patch: Partial<ChecklistItemState>) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
      );
    },
    []
  );

  // ─── Reglas de validación ───────────────────────────────────────
  const answeredCount = useMemo(
    () => items.filter((i) => i.decision !== null).length,
    [items]
  );

  const isValid = useMemo(
    () =>
      items.length > 0 &&
      items.every(
        (item) =>
          item.decision !== null &&
          (item.decision === 'cumple' || item.motivoNoCumple.trim().length > 0)
      ),
    [items]
  );

  const progress = items.length > 0 ? answeredCount / items.length : 0;

  // ─── Envío de la inspección ─────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!isValid || submitLock) return;

    const payload: InspectionPayload = {
      folio: pallet.folio,
      technical_sheet_id: sheet.id,
      observaciones_generales: observaciones.trim(),
      items: [],
      paletizaje_checks: items.map<PaletizajeCheckPayload>((item) => ({
        campo: item.check.key,
        valor_esperado: item.check.unit
          ? `${item.check.value} ${item.check.unit}`
          : item.check.value,
        cumple: item.decision === 'cumple',
        motivo_no_cumple:
          item.decision === 'no_cumple' ? item.motivoNoCumple.trim() : null,
      })),
    };

    setSubmitLock(true);
    setIsSubmitting(true);
    try {
      const response = await sendInspection(payload);
      const aprobado = response.resultado === 'aprobado';

      Alert.alert(
        `INSPECCIÓN ${aprobado ? 'APROBADA' : 'RECHAZADA'}`,
        `Folio ${pallet.folio}\nResultado: ${response.resultado.toUpperCase()} · ID ${response.inspection_id}`,
        [
          {
            text: 'ACEPTAR',
            onPress: () => {
              // Volver al escaneo para el siguiente pallet (descarta el stack).
              navigation.popToTop();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error al guardar',
        error instanceof Error ? error.message : 'No se pudo registrar la inspección.'
      );
    } finally {
      setIsSubmitting(false);
      setSubmitLock(false);
    }
  }, [isValid, submitLock, pallet, sheet.id, observaciones, items, navigation]);

  // Confirmación antes de salir sin guardar.
  const handleCancel = useCallback(() => {
    if (answeredCount === 0) {
      navigation.popToTop();
      return;
    }
    Alert.alert(
      'Descartar inspección',
      '¿Salir sin guardar los avances de este pallet?',
      [
        { text: 'CONTINUAR', style: 'cancel' },
        { text: 'DESCARTAR', style: 'destructive', onPress: () => navigation.popToTop() },
      ]
    );
  }, [answeredCount, navigation]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleCancel} hitSlop={12} style={styles.headerAction}>
          <Text style={styles.headerActionText}>✕ Salir</Text>
        </Pressable>
      ),
    });
  }, [navigation, handleCancel]);

  // ─── Render de cabecera de lista (ficha técnica + progreso) ─────
  const listHeader = (
    <View>
      <View style={styles.sheetCard}>
        <Text style={styles.folioText}>{pallet.folio}</Text>
        <Text style={styles.sheetName}>{sheet.nombre}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipLabel}>VERSIÓN</Text>
            <Text style={styles.metaChipValue}>{sheet.version}</Text>
          </View>
          <View style={[styles.metaChip, styles.metaChipGrow]}>
            <Text style={styles.metaChipLabel}>PACKAGING</Text>
            <Text style={styles.metaChipValue}>{sheet.packaging.nombre}</Text>
          </View>
        </View>

        {/* Barra de progreso */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {answeredCount}/{items.length} verificaciones
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Verificación de paletizaje</Text>
    </View>
  );

  // ─── Render de pie de lista (observaciones + botón final) ───────
  const listFooter = (
    <View style={styles.footerBlock}>
      <Text style={styles.sectionTitle}>Observaciones generales (opcional)</Text>
      <TextInput
        style={styles.observationsInput}
        value={observaciones}
        onChangeText={setObservaciones}
        placeholder="Ej.: Todo en orden / detalle del pallet…"
        placeholderTextColor={colors.placeholder}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!isSubmitting}
        testID="inspection-observations"
      />

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          !isValid && styles.submitButtonDisabled,
          pressed && isValid && styles.submitButtonPressed,
        ]}
        onPress={handleSubmit}
        disabled={!isValid || isSubmitting}
        testID="inspection-submit"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textOnDark} size="large" />
        ) : (
          <Text style={styles.submitButtonText}>FINALIZAR INSPECCIÓN</Text>
        )}
      </Pressable>

      {!isValid ? (
        <Text style={styles.hintText}>
          Completa la decisión de todos los ítems{''}
          {items.some((i) => i.decision === 'no_cumple' && !i.motivoNoCumple.trim())
            ? ' y escribe el motivo de cada "No Cumple"'
            : ''}{' '}
          para habilitar el envío.
        </Text>
      ) : null}
    </View>
  );

  // ─── Tarjeta de verificación ────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: ChecklistItemState; index: number }) => {
      const { check } = item;
      const expected = check.unit ? `${check.value} ${check.unit}` : check.value;

      return (
        <View
          style={[
            styles.itemCard,
            item.decision === 'cumple' && styles.itemCardOk,
            item.decision === 'no_cumple' && styles.itemCardFail,
          ]}
        >
          <View style={styles.itemHeader}>
            <View style={styles.itemIndexBadge}>
              <Text style={styles.itemIndexText}>{index + 1}</Text>
            </View>
            <View style={styles.itemTitleWrap}>
              <Text style={styles.itemMaterialName}>{check.label}</Text>
              <Text style={styles.itemSpecs}>Verificar: {expected}</Text>
            </View>
          </View>

          {/* Botones binarios grandes */}
          <View style={styles.binaryRow}>
            <Pressable
              style={({ pressed }) => [
                styles.cumpleButton,
                item.decision === 'cumple' && styles.cumpleButtonSelected,
                pressed && styles.buttonPressedFx,
              ]}
              onPress={() =>
                updateItem(index, { decision: 'cumple', motivoNoCumple: '' })
              }
              disabled={isSubmitting}
              testID={`check-${check.key}-cumple`}
            >
              <Text style={styles.binaryButtonText}>✓ CUMPLE</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.noCumpleButton,
                item.decision === 'no_cumple' && styles.noCumpleButtonSelected,
                pressed && styles.buttonPressedFx,
              ]}
              onPress={() => updateItem(index, { decision: 'no_cumple' })}
              disabled={isSubmitting}
              testID={`check-${check.key}-no-cumple`}
            >
              <Text style={styles.binaryButtonText}>✕ NO CUMPLE</Text>
            </Pressable>
          </View>

          {/* Motivo obligatorio si No Cumple */}
          {item.decision === 'no_cumple' ? (
            <View style={styles.motivoWrap}>
              <Text style={styles.motivoLabel}>
                MOTIVO DEL INCUMPLIMIENTO *
              </Text>
              <TextInput
                style={styles.motivoInput}
                value={item.motivoNoCumple}
                onChangeText={(t) => updateItem(index, { motivoNoCumple: t })}
                placeholder="Describe el problema (ej.: faltan cajas en la base)"
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={300}
                editable={!isSubmitting}
                testID={`check-${check.key}-motivo`}
              />
            </View>
          ) : null}
        </View>
      );
    },
    [updateItem, isSubmitting]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.check.key}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  headerAction: {
    paddingHorizontal: spacing.sm,
  },
  headerActionText: {
    color: '#FFCDD2',
    fontWeight: '700',
    fontSize: 15,
  },

  // ─ Cabecera de ficha
  sheetCard: {
    backgroundColor: colors.header,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  folioText: {
    color: '#8FE3B0',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sheetName: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  metaChipGrow: {
    flex: 1,
  },
  metaChipLabel: {
    color: '#9FB2C6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  metaChipValue: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },
  progressText: {
    color: colors.textOnDark,
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─ Tarjetas de ítems
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  itemCardOk: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  itemCardFail: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  itemIndexBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIndexText: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.textPrimary,
  },
  itemTitleWrap: {
    flex: 1,
  },
  itemMaterialName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemSpecs: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },

  // ─ Chips principal/reemplazo
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#E3EDFF',
  },
  chipReplaced: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  chipTextActive: {
    color: colors.primary,
  },
  chipTextReplaced: {
    color: colors.warning,
  },

  // ─ Botones binarios
  binaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cumpleButton: {
    flex: 1,
    height: TOUCH_TARGET_HEIGHT + 12,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.success,
    opacity: 0.75,
  },
  noCumpleButton: {
    flex: 1,
    height: TOUCH_TARGET_HEIGHT + 12,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.danger,
    opacity: 0.75,
  },
  cumpleButtonSelected: {
    opacity: 1,
    borderColor: '#0A5A2C',
  },
  noCumpleButtonSelected: {
    opacity: 1,
    borderColor: '#8E1B1B',
  },
  binaryButtonText: {
    color: colors.textOnDark,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  buttonPressedFx: {
    opacity: 0.6,
  },

  // ─ Motivo
  motivoWrap: {
    marginTop: spacing.md,
  },
  motivoLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  motivoInput: {
    minHeight: TOUCH_TARGET_HEIGHT,
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },

  // ─ Footer
  footerBlock: {
    marginTop: spacing.sm,
  },
  observationsInput: {
    minHeight: 110,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  submitButton: {
    height: TOUCH_TARGET_HEIGHT + 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  submitButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitButtonText: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hintText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.warning,
    fontWeight: '600',
    textAlign: 'center',
  },
});
