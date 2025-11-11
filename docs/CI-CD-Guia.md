# 📦💛 CI/CD da Abelinha-v2 — Guia Rápido de Commits & Releases

---

## 🧠 Sistema automatizado com

**Pipeline completo:**

> ✅ Lint → ✅ Test → ✅ Audit → 🐳 Docker → 🚀 Release → 🔔 Discord

---

## 🏷️ Como o Semantic Release funciona

Cada commit define o tipo de atualização da versão com base no prefixo usado:

### 🔹 **feat:** nova funcionalidade

Exemplo: `feat: adicionar sistema de login`

> Gera **minor version** (v1.2.0 → v1.3.0)

### 🔹 **fix:** correção de bug

Exemplo: `fix: corrigir erro no carregamento de avatar`

> Gera **patch version** (v1.3.0 → v1.3.1)

### 🔹 **BREAKING CHANGE:** alteração que quebra compatibilidade

Exemplo: `feat!: alterar formato do arquivo de configuração`

> Gera **major version** (v1.3.0 → v2.0.0)

### 🔹 Outros tipos de commit

* `chore:` tarefas de manutenção
* `docs:` documentação
* `refactor:` refatoração de código sem alterar comportamento
* `test:` adição ou ajuste de testes
* `perf:` melhoria de performance
* `style:` mudanças visuais ou de formatação

---

## ⚙️ O que acontece quando damos push no main

1️⃣ **Lint** — verifica o estilo e qualidade do código
2️⃣ **Test** — executa testes e auditoria de segurança
3️⃣ **Semantic Release** — analisa os commits desde o último tag:

* Decide se deve criar nova versão (major/minor/patch)
* Atualiza `package.json`
* Cria automaticamente:

  * 🔹 Tag: `vX.Y.Z`
  * 🔹 GitHub Release com changelog
    4️⃣ **Docker Build & Push**
* Cria imagem `abelhinha-v2:vX.Y.Z`
* Publica também `:latest` no Docker Hub
  5️⃣ **Notify**
* Envia mensagem automática no Discord:

  * ✅ Sucesso ou ❌ Falha
  * Link direto pros logs

---

## 🔐 Tokens necessários nos Secrets

| Nome              | Permissão | Função                            |
| ----------------- | --------- | --------------------------------- |
| `GH_TOKEN`        | `repo`    | Criar tags e releases automáticos |
| `DOCKER_USERNAME` | —         | Usuário do Docker Hub             |
| `DOCKER_TOKEN`    | —         | Token de acesso ao Docker Hub     |
| `DISCORD_WEBHOOK` | —         | Enviar notificações de build      |

---

## 🧩 Dica rápida: boas práticas

✔ Use mensagens claras e padronizadas
✔ Faça commits pequenos e frequentes
✔ Não pule o tipo de commit — ele define o release!
✔ Evite mensagens genéricas tipo “update” ou “fix bug”

---

## 🐝 Abelinha-v2 — automatizando com estilo 💛
