// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import eslintPluginJest from "eslint-plugin-jest"; // <-- Importa o plugin do Jest

export default [
  // 1. Configuração Padrão (Recomendada)
  js.configs.recommended,

  // 2. Configuração Principal do seu Projeto (CommonJS/Node)
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
      "no-redeclare": ["error", { "builtinGlobals": false }],
    },
  },

  // 3. ---- A CORREÇÃO CRÍTICA VEM AQUI ----
  // Configuração específica para arquivos de TESTE
  {
    // Carrega a configuração recomendada do Jest
    ...eslintPluginJest.configs['flat/recommended'],

    // E aplica ela APENAS a estes arquivos
    files: [
      "**/*.test.js",
      "**/*.spec.js"
    ],
    
    // Adiciona os globais do Jest (describe, test, expect)
    // (Mesmo que a config acima já inclua, isso garante)
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  },
  
  // 4. Ignora arquivos de configuração do linting
  {
    ignores: [
      "eslint.config.mjs",
      "jest.config.js",
      "coverage/"
    ]
  }
];