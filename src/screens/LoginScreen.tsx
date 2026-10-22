/**
 * CheckPalletGarate - Pantalla de inicio de sesión
 * Formulario correo/contraseña con ActivityIndicator y alertas de error.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, TOUCH_TARGET_HEIGHT } from '../theme';

export default function LoginScreen(): React.JSX.Element {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu correo y contraseña para continuar.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email: trimmedEmail, password });
      // La navegación es reactiva al estado de AuthContext (AppNavigator).
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No fue posible iniciar sesión.';
      Alert.alert('Credenciales inválidas', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.logoTitle}>CheckPallet</Text>
          <Text style={styles.logoSubtitle}>GARATE</Text>
          <Text style={styles.tagline}>Control de conformación de pallets</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="usuario@ejemplo.com"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isSubmitting}
            testID="login-email"
          />

          <Text style={[styles.label, styles.labelSpacing]}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            editable={!isSubmitting}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            testID="login-password"
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || isSubmitting) && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            testID="login-submit"
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textOnDark} size="large" />
            ) : (
              <Text style={styles.submitButtonText}>INICIAR SESIÓN</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Operario: {'' /* placeholder para info de planta */}
          {'\n'}Versión app 1.0 · Laravel API v1
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.header,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textOnDark,
    letterSpacing: 0.5,
  },
  logoSubtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7FB2FF',
    letterSpacing: 6,
    marginTop: spacing.xs,
  },
  tagline: {
    fontSize: 15,
    color: '#C9D6E4',
    marginTop: spacing.sm,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  labelSpacing: {
    marginTop: spacing.md,
  },
  input: {
    height: TOUCH_TARGET_HEIGHT,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  submitButton: {
    marginTop: spacing.lg,
    height: TOUCH_TARGET_HEIGHT + 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonPressed: {
    backgroundColor: colors.primaryPressed,
    opacity: 0.9,
  },
  submitButtonText: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    textAlign: 'center',
    color: '#9FB2C6',
    fontSize: 13,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});
