import { Anchor, createTheme, rem } from '@mantine/core';

// See also index.scss for style overrides for components (Button, Modal, TextInput)
export default createTheme({
  components: {
    // links inside running text should match its size rather than default to `md`
    Anchor: Anchor.extend({ defaultProps: { inherit: true } }),
  },
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
});
