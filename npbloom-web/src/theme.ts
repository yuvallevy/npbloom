import { MantineThemeOverride, rem } from '@mantine/core';

const globalTheme: MantineThemeOverride = {
  defaultGradient: { deg: 60, from: 'green', to: 'teal' },
  primaryColor: 'green',
  primaryShade: 9,
  shadows: {
    xs: '0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05), 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.04)',
    sm: '0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 0.5rem 0.75rem -0.25rem, rgba(0, 0, 0, 0.04) 0 0.375rem 0.375rem -0.25rem',
    md: '0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 1rem 1.25rem -0.25rem, rgba(0, 0, 0, 0.04) 0 0.5rem 0.5rem -0.25rem',
    lg: '0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 1.375rem 1.125rem -0.375rem, rgba(0, 0, 0, 0.04) 0 0.625rem 0.625rem -0.375rem',
    xl: '0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 1.75rem 1.375rem -0.375rem, rgba(0, 0, 0, 0.04) 0 0.875rem 0.875rem -0.375rem',
  },
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },
  radius: {
    xs: rem(2),
    sm: rem(2),
    md: rem(4),
    lg: rem(6),
    xl: rem(8),
  },
  spacing: {
    xs: rem(6),
    sm: rem(8),
    md: rem(10),
    lg: rem(12),
    xl: rem(16),
  },
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","Roboto","Oxygen","Ubuntu","Helvetica",' +
    '"Cantarell","Fira Sans","Droid Sans","Helvetica Neue",sans-serif',
};

const sizes = {
  xs: rem(24),
  sm: rem(28),
  md: rem(34),
  lg: rem(40),
  xl: rem(48),
};

const componentThemes: MantineThemeOverride['components'] = {
  Anchor: {
    styles: (theme) => ({
      root: {
        // Force shade 9 for links, since Mantine's default is shade 7
        color: theme.colors[theme.primaryColor][9],
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      },
    }),
  },
  TextInput: {
    sizes: {
      xs: () => ({ input: { height: sizes.xs, minHeight: sizes.xs } }),
      sm: () => ({ input: { height: sizes.sm, minHeight: sizes.sm } }),
      md: () => ({ input: { height: sizes.md, minHeight: sizes.md } }),
      lg: () => ({ input: { height: sizes.lg, minHeight: sizes.lg } }),
      xl: () => ({ input: { height: sizes.xl, minHeight: sizes.xl } }),
    },
  },
  Button: {
    styles: (theme, _, { variant }) => ({
      root: {
        fontWeight: 'normal',
        borderColor:
          variant === 'light' || variant === 'subtle' || variant === 'white' ? 'transparent' : 'rgba(0, 0, 0, 0.1)',
        boxShadow:
          variant === 'light' || variant === 'subtle' || variant === 'white' ? 'none' : theme.shadows.xs,
      },
    }),
    sizes: {
      xs: () => ({ root: { height: sizes.xs, paddingLeft: rem(10), paddingRight: rem(10) } }),
      sm: () => ({ root: { height: sizes.sm, paddingLeft: rem(12), paddingRight: rem(12) } }),
      md: () => ({ root: { height: sizes.md, paddingLeft: rem(14), paddingRight: rem(14) } }),
      lg: () => ({ root: { height: sizes.lg, paddingLeft: rem(16), paddingRight: rem(16) } }),
      xl: () => ({ root: { height: sizes.xl, paddingLeft: rem(18), paddingRight: rem(18) } }),
      'compact-xs': () => ({ root: { height: rem(22), paddingLeft: rem(7), paddingRight: rem(7) } }),
      'compact-sm': () => ({ root: { height: rem(26), paddingLeft: rem(8), paddingRight: rem(8) } }),
      'compact-md': () => ({ root: { height: rem(30), paddingLeft: rem(10), paddingRight: rem(10) } }),
      'compact-lg': () => ({ root: { height: rem(34), paddingLeft: rem(12), paddingRight: rem(12) } }),
      'compact-xl': () => ({ root: { height: rem(40), paddingLeft: rem(14), paddingRight: rem(14) } }),
    },
  },
  Modal: {
    styles: {
      header: {
        padding: rem(18),
        paddingRight: rem(12),
      },
      body: {
        padding: rem(18),
      },
    },
  },
};

export default { ...globalTheme, components: componentThemes };
