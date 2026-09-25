// ESLint flat config.
//
// Next 16 removed `next lint`, and eslint-config-next now ships native flat
// configs. The previous setup wrapped the legacy shareable configs in
// FlatCompat, which crashes on v16 with a circular-reference error while
// validating the old eslintrc schema. Importing the flat configs directly is
// the supported path and drops the @eslint/eslintrc compat layer entirely.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  },
  {
    // Full jsx-a11y recommended set (WCAG 2.2 AA work, docs/compliance/).
    // eslint-config-next registers the plugin but turns on only six of its
    // rules; the plugin object is not re-registered here, only its rules.
    // Static checks catch missing labels, alt text and non-interactive click
    // handlers; they do not replace keyboard and screen-reader testing.
    files: ['**/*.{jsx,tsx}'],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    // Staff/admin/kitchen screens were outside the customer-facing scope of
    // the first accessibility pass. Their existing violations are warnings so
    // they stay visible without failing lint; tracked as a follow-up in
    // docs/compliance/accessibility-audit.md. New customer code gets errors.
    files: [
      'src/app/(staff)/**',
      'src/features/{clients,kitchen,menu,staff}/**',
      'src/features/promo-campaign/campaign-management.tsx',
      'src/features/service-period/{menu-composition,service-period-management}.tsx',
    ],
    rules: Object.fromEntries(
      Object.keys(jsxA11y.flatConfigs.recommended.rules).map((rule) => [rule, 'warn']),
    ),
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
  },
];

export default eslintConfig;
