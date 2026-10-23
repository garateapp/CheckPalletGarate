/**
 * CheckPalletGarate - Contexto de autenticación
 *
 * Gestiona el estado de sesión (user, token, isLoading) y la persistencia
 * del token en expo-secure-store. Al montar la app verifica si existe una
 * sesión previa (SecureStore.getItemAsync('user_token')) para omitir el login.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  login as apiLogin,
  logoutRequest,
  normalizeToken,
  setOnUnauthorized,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from '../services/api';
import type { LoginRequest, User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** true mientras se restaura la sesión persistida al arrancar */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Restaurar sesión persistida al iniciar la app ──────────────
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_STORAGE_KEY);

        if (mounted && storedToken) {
          setToken(normalizeToken(storedToken));
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser) as User);
            } catch {
              // Perfil corrupto: se limpia, el token sigue siendo válido.
              await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
            }
          }
        }
      } catch {
        // Fallo leyendo SecureStore: continuar sin sesión.
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Redirección automática ante 401 (token expirado) ────────────
  useEffect(() => {
    setOnUnauthorized(() => {
      setToken(null);
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  // ─── Login ──────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginRequest): Promise<void> => {
    const response = await apiLogin(credentials);
    const cleanToken = normalizeToken(response.token);

    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, cleanToken);
    await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(response.user));

    setToken(cleanToken);
    setUser(response.user);
  }, []);

  // ─── Logout ─────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    await logoutRequest();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!token,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook de acceso al contexto de autenticación. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.');
  }
  return context;
}
