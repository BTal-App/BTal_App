import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Config plana de ESLint 9 para las Cloud Functions. Mínima · sin reglas
// type-aware (no parserOptions.project) para no chocar con el propio
// config file. tsc (npm run build) es el typecheck real previo al deploy.
export default [
  { ignores: ['lib/**', 'node_modules/**', 'eslint.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Permitimos control chars en regex · sanitize() de prompt.ts los
      // usa intencionalmente para neutralizar input del usuario.
      'no-control-regex': 'off',
    },
  },
];
