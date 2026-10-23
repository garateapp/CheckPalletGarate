# CheckPalletGarate — Resumen de la Aplicación

App móvil industrial construida con **Expo SDK 58 + TypeScript** para el control de calidad en el conformado de pallets. Se conecta a una **API REST en Laravel 12** (`/api/v1`).

---

## 🎯 ¿Qué hace la app?

Flujo principal de operación en planta:

```
Login → Escanear folio del pallet → Checklist binario por ítem → Enviar inspección → Siguiente pallet
```

1. **Autenticación**: el operario inicia sesión con email y contraseña. El token JWT/Sanctum se guarda de forma segura (SecureStore) y se verifica al abrir la app; si expira (401), se cierra sesión automáticamente.
2. **Escaneo de pallet**: lectura del código de barras del folio (ej. `PAL-2026-00451`) con la cámara (`expo-camera` `CameraView`) o entrada manual como respaldo. Al obtener el folio, se carga la **ficha técnica de conformación** desde `GET /api/v1/pallets/{folio}`.
3. **Checklist binario**: por cada ítem de la ficha (material, calibre, cantidad estándar esperada) el operario marca **[✓ Cumple]** o **[✕ No Cumple]** — sin rangos numéricos.
   - Si el ítem tiene **material de reemplazo** definido, puede alternar entre "Material Principal" y "Material de Reemplazo" mediante un chip/toggle.
   - Si marca *No Cumple*, se despliega inmediatamente un campo **obligatorio** para el motivo.
4. **Envío de inspección**: el botón "Finalizar Inspección" permanece deshabilitado hasta que el **100% de los ítems** estén resueltos (con motivo incluido si aplica). Se envía `POST /api/v1/inspections` y se muestra el resultado (**APROBADO / RECHAZADO**) antes de volver al escáner para el siguiente pallet.

---

## 🏗️ Arquitectura y estructura de código

```
checkpalletgarate/
├── App.tsx                        # Entry point: AuthProvider + NavigationContainer + StatusBar
├── app.json                       # Configuración Expo (newArchEnabled, plugins camera/secure-store)
├── package.json                   # Dependencias Expo SDK 58
└── src/
    ├── types/index.ts             # Contratos tipados de la API
    ├── services/api.ts            # Cliente HTTP centralizado
    ├── context/AuthContext.tsx    # Estado global de sesión
    ├── navigation/AppNavigator.tsx# Flujo condicional Auth vs. App
    └── screens/
        ├── LoginScreen.tsx        # Formulario de acceso
        ├── ScanScreen.tsx         # Cámara + entrada manual de folio
        └── ChecklistScreen.tsx    # Inspección por ítems
```

### Módulos clave

| Módulo | Responsabilidad | Detalles de implementación |
|---|---|---|
| **`src/types/index.ts`** | Tipos TS | `User`, `Material`, `Packaging`, `PalletItem`, `TechnicalSheet`, `PalletResponse`, `InspectionItemPayload`, `InspectionPayload`, `InspectionResponse`. Reflejan exactamente los contratos JSON del backend (incluye `replacement_material: Material \| null`, `calibre: string \| null`). |
| **`src/services/api.ts`** | Axios | Instancia con `baseURL` configurable vía `EXPO_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`). **Interceptor de petición**: inyecta `Authorization: Bearer <token>` leyendo de `SecureStore`. **Interceptor de respuesta**: ante **401** limpia el token y emite evento `auth:unauthorized` → la app redirige a Login. Manejo centralizado de errores normalizados. |
| **`src/context/AuthContext.tsx`** | Sesión | Provee `{ user, token, isLoading, login, logout }`. Al montar, restaura sesión con `SecureStore.getItemAsync('user_token')` (+ usuario persistido). Persiste/cleanup en login/logout y escucha el evento de expiración del interceptor. |
| **`src/screens/LoginScreen.tsx`** | Login | Inputs email/contraste alto, validación básica, `ActivityIndicator` en el submit, `Alert` en credenciales inválidas (422/401). |
| **`src/screens/ScanScreen.tsx`** | Escaneo | `CameraView` de `expo-camera` con barcode scanner (solo códigos de barras), solicitud de permisos de cámara con UI de fallback. Toggle **Cámara ↔ Entrada manual** (TextInput + botón "Buscar"). Feedback de carga (`ActivityIndicator` + estado "Buscando…"), bloqueo anti doble-escaneo (`isProcessing` ref/estado), navegación a Checklist con `PalletResponse`. Header con botón de cerrar sesión. |
| **`src/screens/ChecklistScreen.tsx`** | Inspección | Cabecera con Folio / Nombre de ficha / Versión / Packaging. `FlatList` de tarjetas por ítem: material, calibre, cantidad estándar. Chip toggle Principal/Reemplazo solo si existe `replacement_material`. Botones grandes verde/rojo (binarios). Motivo obligatorio desplegable en "No Cumple". `TextInput` opcional para observaciones generales. Botón final deshabilitado hasta completar todo; al enviar muestra `Alert` con APROBADO/RECHAZADO y regresa al escáner (`reset` a Scan). |
| **`src/navigation/AppNavigator.tsx`** | Navegación | `createNativeStackNavigator`. Si no hay sesión → stack `Login`. Si hay sesión → stack `Scan → Checklist`. Transición automática según estado de `AuthContext` (con pantalla de splash/loading mientras se verifica SecureStore). |

### UI / Estilos

- Todos los estilos en `StyleSheet.create` orientados a **uso industrial**: botones táctiles grandes, alto contraste (verde `#16a34a` / rojo `#dc2626`), tipografía legible, tarjetas con separación clara y estados visuales de selección/deshabilitado.

---

## 🔌 Contrato con el backend (Laravel 12)

| Endpoint | Método | Uso en la app |
|---|---|---|
| `/api/v1/auth/login` | POST | LoginScreen → `{ token, user }` |
| `/api/v1/pallets/{folio}` | GET | ScanScreen → ficha técnica + items |
| `/api/v1/inspections` | POST | ChecklistScreen → payload con `items[]` (`technical_sheet_pallet_item_id`, `material_utilizado_id`, `es_reemplazo`, `cumple`, `motivo_no_cumple`) → `{ message, resultado, inspection_id }` |

Los endpoints requieren header `Authorization: Bearer <token>` (inyectado automáticamente por el interceptor).

---

## 📦 Librerías principales (Expo SDK 58)

| Librería | Función |
|---|---|
| `expo` ~58 + `react-native` 0.88 + `react` 19.3 | Runtime base (New Architecture habilitado) |
| `axios` | Cliente HTTP con interceptores |
| `expo-secure-store` (~58.0.2) | Persistencia cifrada del token |
| `expo-camera` (~58.0.12) | Lector de códigos de barras (`CameraView`) |
| `@react-navigation/native` + `native-stack` | Navegación por pantallas |
| `react-native-screens` / `react-native-safe-area-context` | Soporte de navegación |
| `typescript` ~6.0 | Tipado estricto |

La URL de la API se configura sin tocar código mediante variable de entorno: `EXPO_PUBLIC_API_URL` (en `.env` o al ejecutar `npx expo start`).

---

## ✅ Estado de verificación

- `npx tsc --noEmit` → **0 errores**
- `npx expo export --platform android` → bundle Hermes generado correctamente
- `npx expo install --check` → dependencias alineadas con SDK 58

> **Nota de entorno**: Expo SDK 58 requiere **Node ≥ 22.13** para uso completo (`expo start` / EAS Build).
