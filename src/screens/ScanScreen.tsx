/**
 * CheckPalletGarate - Pantalla de escaneo de folio de pallet
 *
 * - Lector de código de barras con la API moderna de expo-camera (CameraView).
 * - Manejo explícito de permisos de cámara.
 * - Pestañas para alternar entre Cámara y Entrada Manual del folio.
 * - GET /api/v1/pallets/{folio} con feedback de carga y bloqueo de doble escaneo.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult, BarcodeType } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchPallet } from '../services/api';
import type { PalletResponse } from '../types';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, TOUCH_TARGET_HEIGHT } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Scan'>;

type ScanMode = 'camera' | 'manual';

// Symbologies habituales en logística de pallets.
const SCANNABLE_CODES: BarcodeType[] = [
  'code128',
  'code39',
  'itf14',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'qr',
];

export default function ScanScreen({ navigation }: Props): React.JSX.Element {
  const [mode, setMode] = useState<ScanMode>('camera');
  const [manualFolio, setManualFolio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  /** Bloqueo anti doble escaneo accidental (refs síncronas). */
  const lockRef = useRef(false);
  const lastBarcodeRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  // ─── Consulta del folio a la API ────────────────────────────────
  const lookupFolio = useCallback(
    async (rawFolio: string) => {
      const folio = rawFolio.trim().toUpperCase();

      if (!folio) {
        Alert.alert('Folio vacío', 'Escanea o escribe el folio del pallet.');
        return;
      }

      if (lockRef.current) return; // Evita peticiones dobles.
      lockRef.current = true;
      setIsLoading(true);

      try {
        const pallet: PalletResponse = await fetchPallet(folio);

        if (!pallet.technical_sheet?.pallet_items?.length) {
          Alert.alert(
            'Ficha sin ítems',
            `El folio ${folio} tiene una ficha técnica sin materiales configurados.`
          );
          return;
        }

        navigation.navigate('Checklist', { pallet });
      } catch (error) {
        Alert.alert(
          'No se pudo cargar el pallet',
          error instanceof Error ? error.message : 'Error desconocido.'
        );
      } finally {
        setIsLoading(false);
        // Pequeña pausa para que el operario vea el resultado antes de re-habilitar.
        setTimeout(() => {
          lockRef.current = false;
          lastBarcodeRef.current = { value: '', at: 0 };
        }, 800);
      }
    },
    [navigation]
  );

  // ─── Callback del lector de códigos ─────────────────────────────
  const handleBarcode = useCallback(
    (event: BarcodeScanningResult) => {
      // Descarta lecturas repetidas del mismo código en < 2 s.
      if (lockRef.current) return;
      const now = Date.now();
      if (
        event.data === lastBarcodeRef.current.value &&
        now - lastBarcodeRef.current.at < 2000
      ) {
        return;
      }
      lastBarcodeRef.current = { value: event.data, at: now };
      void lookupFolio(event.data);
    },
    [lookupFolio]
  );

  const handleManualSubmit = useCallback(() => {
    void lookupFolio(manualFolio);
  }, [lookupFolio, manualFolio]);

  // ─── Permisos de cámara ─────────────────────────────────────────
  if (mode === 'camera' && (!permission || !permission.granted)) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Permiso de cámara requerido</Text>
          <Text style={styles.permissionBody}>
            {permission?.canAskAgain
              ? 'La app necesita acceso a la cámara para leer los códigos de barra de los pallets.'
              : 'El acceso fue denegado. Habilítalo desde Ajustes del dispositivo para usar el lector, o ingresa el folio manualmente.'}
          </Text>
          {permission?.canAskAgain ? (
            <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
              <Text style={styles.primaryButtonText}>OTORGAR PERMISO</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.primaryButton, styles.secondaryVariant]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.primaryButtonText, styles.secondaryVariantText]}>
              INGRESAR FOLIO MANUAL
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Selector de modo Cámara / Manual */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, mode === 'camera' && styles.tabActive]}
          onPress={() => setMode('camera')}
        >
          <Text style={[styles.tabText, mode === 'camera' && styles.tabTextActive]}>
            📷 Cámara
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'manual' && styles.tabActive]}
          onPress={() => setMode('manual')}
        >
          <Text style={[styles.tabText, mode === 'manual' && styles.tabTextActive]}>
            ⌨️ Entrada manual
          </Text>
        </Pressable>
      </View>

      {mode === 'camera' ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: SCANNABLE_CODES }}
            onBarcodeScanned={isLoading ? undefined : handleBarcode}
          />
          {/* Marco guía de lectura */}
          <View pointerEvents="none" style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>
              Apunta el lector al código de barra del pallet
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.manualCard}>
          <Text style={styles.label}>Folio del pallet</Text>
          <TextInput
            style={styles.input}
            value={manualFolio}
            onChangeText={(t) => setManualFolio(t.toUpperCase())}
            placeholder="PAL-2026-00451"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isLoading}
            onSubmitEditing={handleManualSubmit}
            returnKeyType="search"
            testID="manual-folio-input"
          />
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleManualSubmit}
            disabled={isLoading}
            testID="manual-folio-search"
          >
            <Text style={styles.primaryButtonText}>BUSCAR</Text>
          </Pressable>
        </View>
      )}

      {/* Feedback de carga superpuesto */}
      {isLoading ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Consultando ficha técnica…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    height: TOUCH_TARGET_HEIGHT,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.header,
    borderColor: colors.header,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnDark,
  },
  cameraWrap: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '82%',
    height: '38%',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  scanHint: {
    marginTop: spacing.md,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  manualCard: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    height: TOUCH_TARGET_HEIGHT + 8,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  primaryButton: {
    height: TOUCH_TARGET_HEIGHT + 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  secondaryVariant: {
    backgroundColor: colors.surfaceAlt,
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryButtonText: {
    color: colors.textOnDark,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  secondaryVariantText: {
    color: colors.textPrimary,
  },
  permissionCard: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  permissionBody: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 42, 67, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    minWidth: 220,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
