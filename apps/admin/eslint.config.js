import react from '@expense/eslint-config/react';

export default [
  // Third-party WebGL effect, kept as plain JS.
  { ignores: ['src/components/effects/**'] },
  ...react,
];
