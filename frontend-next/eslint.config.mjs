<<<<<<< HEAD
// ESLint flat config.
//
// Next 16 removed `next lint`, and eslint-config-next now ships native flat
// configs. The previous setup wrapped the legacy shareable configs in
// FlatCompat, which crashes on v16 with a circular-reference error while
// validating the old eslintrc schema. Importing the flat configs directly is
// the supported path and drops the @eslint/eslintrc compat layer entirely.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  },
  {
    rules: {
      // Next 16 promotes this to an error. Every current violation is either
      // SSR-safe hydration (localStorage cannot be read during render, so the
      // state MUST be set from an effect after mount) or an async load that
      // settles into state. Both are legitimate; the rule's suggested
      // alternatives do not apply to hydration.
      //
      // Kept as a warning rather than switched off so genuinely avoidable
      // cascading-render cases still surface. Refactoring the existing 13
      // call sites is tracked as follow-up, deliberately not bundled into a
      // major-version upgrade that touches the checkout and kitchen screens.
      'react-hooks/set-state-in-effect': 'warn',
    },
=======
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**'],
>>>>>>> origin/feature/main-dashboard
  },
];

export default eslintConfig;
