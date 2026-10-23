/**
 * CheckPalletGarate - Tema visual compartido
 * Paleta de alto contraste pensada para uso industrial (guantes, luz solar,
 * pantallas de terminales Zebra/Honeywell). Botones grandes y tipografía clara.
 */
export const colors = {
  // Fondo y superficies
  background: '#F2F4F7',
  surface: '#FFFFFF',
  surfaceAlt: '#E8ECF1',
  header: '#0F2A43',
  headerText: '#FFFFFF',

  // Texto
  textPrimary: '#1A1D21',
  textSecondary: '#5A6472',
  textOnDark: '#FFFFFF',

  // Marca
  primary: '#0B5FFF',
  primaryPressed: '#0948C2',

  // Semánticos (alto contraste)
  success: '#0E7A3C',
  successBg: '#E1F5EA',
  danger: '#C62828',
  dangerBg: '#FDECEC',
  warning: '#B25E00',
  warningBg: '#FFF3E0',

  // Formulario
  inputBorder: '#B7C0CC',
  inputFocus: '#0B5FFF',
  placeholder: '#8B95A5',

  // Neutros
  border: '#D5DBE3',
  disabled: '#C3CAD4',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Altura mínima táctil recomendada para uso con guantes. */
export const TOUCH_TARGET_HEIGHT = 56;
