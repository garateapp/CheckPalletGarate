# CheckPalletGarate 📱🪵

Aplicación móvil industrial (React Native + Expo + TypeScript) para la **verificación de
conformación de pallets**. Se conecta a una API REST en **Laravel 12** (Sanctum).

Flujo: `Login → Escaneo de folio (código de barra o manual) → Checklist binario
(Cumple / No Cumple por material) → POST inspección → Resultado APROBADO/RECHAZADO`.

## Estructura

```
App.tsx                      # Root: SafeArea + AuthProvider + Navigator
index.ts                     # registerRootComponent
app.json                     # Config Expo (permisos cámara, plugins, apiUrl)
src/
  types/index.ts             # Contratos tipados de la API v1
  services/api.ts            # Axios + interceptores (Bearer token, 401 → login)
  context/AuthContext.tsx    # Sesión reactiva con persistencia SecureStore
  navigation/AppNavigator.tsx# Auth stack vs App stack según token
  screens/LoginScreen.tsx    # Formulario de acceso
  screens/ScanScreen.tsx     # expo-camera CameraView + entrada manual
  screens/ChecklistScreen.tsx# FlatList validación binaria estricta
  theme.ts                   # Paleta industrial alto contraste
```

## Configuración de la API

Edita `app.json` → `extra.apiUrl`, o define la variable pública:

```bash
EXPO_PUBLIC_API_URL=https://api.garate.com/api/v1 npx expo start
```

Sin configuración usa `http://10.0.2.2:8000/api/v1` (Laravel local visto desde el
emulador Android). Para dispositivo físico usa la IP LAN del servidor.

## Endpoints consumidos

| Método | Ruta                          | Uso                       |
|--------|-------------------------------|---------------------------|
| POST   | `/api/v1/auth/login`          | Obtener token Sanctum     |
| GET    | `/api/v1/pallets/{folio}`     | Ficha técnica del pallet  |
| POST   | `/api/v1/inspections`         | Registrar checklist       |

## Ejecutar

```bash
npm install
npx expo install expo-secure-store expo-camera react-native-safe-area-context \
  @react-navigation/native @react-navigation/native-stack react-native-screens
npm run typecheck   # sin errores TS esperados
npm start           # Expo Go o build dev-client
```

> Nota: `expo-secure-store` no funciona en web; usar iOS/Android o dev build.

## Seguridad

- Token JWT/Sanctum guardado cifrado en **SecureStore** (`user_token`).
- El interceptor limpia la sesión y redirige al login ante cualquier **401**.
- Normalización del prefijo `Bearer` duplicado que a veces devuelve Sanctum.

## Reglas de negocio implementadas

- Validación binaria estricta por ítem: solo `✓ Cumple` / `✕ No Cumple`.
- `No Cumple` exige motivo de texto antes de permitir el envío.
- Toggle Principal/Reemplazo cuando la ficha define `replacement_material`
  (envía `material_utilizado_id` + `es_reemplazo` correctos).
- Botón "Finalizar Inspección" deshabilitado hasta completar el 100 % de los ítems.
- Bloqueo anti doble escaneo y anti doble submit.
