// @ts-check
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Architecture layering (SDD §3). core imports nothing; each layer only sees
// what it is allowed to see. Violations fail CI, not code review.
const layerAllowances = {
  core: ['core'],
  providers: ['providers', 'core'],
  platform: ['platform', 'core'],
  'site-adapters': ['site-adapters', 'core'],
  ui: ['ui', 'core', 'platform', 'assets'],
  'content-ui': ['content-ui', 'ui', 'core', 'platform', 'site-adapters', 'assets'],
  entrypoints: [
    'entrypoints',
    'content-ui',
    'ui',
    'core',
    'platform',
    'providers',
    'site-adapters',
    'assets',
  ],
};

const layerPolicies = Object.entries(layerAllowances).map(([from, to]) => ({
  from: { element: { types: from } },
  allow: { to: { element: { types: { anyOf: to } } } },
}));

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/**' },
        { type: 'providers', pattern: 'src/providers/**' },
        { type: 'platform', pattern: 'src/platform/**' },
        { type: 'site-adapters', pattern: 'src/site-adapters/**' },
        { type: 'content-ui', pattern: 'src/content-ui/**' },
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'entrypoints', pattern: 'src/entrypoints/**' },
        { type: 'assets', pattern: 'src/assets/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: layerPolicies,
        },
      ],
      // XSS defense-in-depth (SDD §7): model output must never become markup.
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message: 'Never assign markup — render text nodes only (SDD §7).',
        },
        {
          property: 'outerHTML',
          message: 'Never assign markup — render text nodes only (SDD §7).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned (SDD §7).',
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // React rules only where React runs (Playwright fixtures also use a `use`
    // callback that false-positives the hooks rule).
    files: ['src/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Config files run in node without a project reference.
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettierConfig,
);
