// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";

export default [
  // 1. Configuração recomendada
  js.configs.recommended,

  // 2. Configuração principal do seu projeto
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.commonjs
      }
    },
    
    rules: {
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "no-console": "off",
      "no-redeclare": ["error", { "builtinGlobals": false }],
      "no-empty": ["warn", { "allowEmptyCatch": true }],
      "no-prototype-builtins": "off"
    }
  },

  // 3. Ignora o próprio arquivo de configuração
  {
    ignores: ["eslint.config.mjs"]
  }
];