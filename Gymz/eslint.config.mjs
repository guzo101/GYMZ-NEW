import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
    {
        ignores: ['node_modules/**', 'dist/**', '.expo/**', 'android/**', 'ios/**', '**/*.js', '**/*.cjs', '**/*.mjs'],
    },
    {
        files: ['**/*.{ts,tsx}'],
    },
    ...compat.extends('expo'),
];
