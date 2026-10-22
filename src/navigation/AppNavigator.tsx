/**
 * CheckPalletGarate - Navegación principal
 *
 * Flujo reactivo:
 *  - Sin token  → Auth stack (LoginScreen).
 *  - Con token  → App stack (ScanScreen → ChecklistScreen) con botón de
 *    cerrar sesión en la cabecera de Scan.
 */
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PalletResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import ScanScreen from '../screens/ScanScreen';
import ChecklistScreen from '../screens/ChecklistScreen';
import { colors } from '../theme';

/** Parámetros tipados del stack autenticado. */
export type AppStackParamList = {
  Scan: undefined;
  Checklist: { pallet: PalletResponse };
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator();

// ─── Pantalla splash mientras se restaura la sesión ───────────────

function SplashScreen(): React.JSX.Element {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashTitle}>CheckPallet GARATE</Text>
      <ActivityIndicator size="large" color={colors.textOnDark} />
      <Text style={styles.splashText}>Restaurando sesión…</Text>
    </View>
  );
}

// ─── Stack autenticado (Scan → Checklist) ─────────────────────────

function AuthenticatedNavigator(): React.JSX.Element {
  const { user, logout } = useAuth();

  const handleLogout = (): void => {
    Alert.alert(
      'Cerrar sesión',
      `¿Salir de ${user?.name ?? 'la aplicación'}?`,
      [
        { text: 'CANCELAR', style: 'cancel' },
        {
          text: 'CERRAR SESIÓN',
          style: 'destructive',
          onPress: () => void logout(),
        },
      ]
    );
  };

  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AppStack.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          title: user ? `Hola, ${user.name}` : 'CheckPallet Garate',
          headerRight: () => (
            <Pressable onPress={handleLogout} hitSlop={12} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          ),
        }}
      />
      <AppStack.Screen
        name="Checklist"
        component={ChecklistScreen}
        options={{ title: 'Checklist de conformación' }}
      />
    </AppStack.Navigator>
  );
}

// ─── Stack de autenticación (Login) ───────────────────────────────

function AuthNavigator(): React.JSX.Element {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Root ─────────────────────────────────────────────────────────

export default function AppNavigator(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AuthenticatedNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.header,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  splashTitle: {
    color: colors.textOnDark,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  splashText: {
    color: '#9FB2C6',
    fontSize: 15,
  },
  logoutButton: {
    paddingHorizontal: 8,
  },
  logoutText: {
    color: '#FFCDD2',
    fontWeight: '700',
    fontSize: 14,
  },
});
