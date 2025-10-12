# 🚀 Cronograma da Força-Tarefa: Lançamento do MVP de Recrutamento

**Missão Principal:** Construir a fundação do novo bot e integrar as funcionalidades do Módulo de Recrutamento, com o objetivo de ter um MVP funcional para testes até **Domingo, 19 de Outubro de 2025**.

### 🗓️ Resumo da Semana (13/Out - 19/Out)

| Prazo                      | Foco Principal             | Responsáveis Principais          | Entregáveis Chave                                         |
| -------------------------- | -------------------------- | -------------------------------- | --------------------------------------------------------- |
| **Seg, 13 - Qua, 15/Out** | Fundação e Planejamento    | `Gui & Erick` (Arquitetura), `Docs Team` | Esqueleto do Bot pronto, Documentação dos comandos        |
| **Qua, 15 - Sex, 17/Out** | Adaptação e Integração     | `Narum & Ky` (Código), `Gui` (Revisão) | Protótipo do `/registrar` integrado e funcional no novo bot |
| **Sab, 18 - Dom, 19/Out** | Testes, Correções e Entrega | `Q&A Team`, `Toda a Equipe`      | MVP testado, bugs críticos corrigidos e pronto para deploy |

---

### ✅ Checklist de Tarefas da Semana

#### 👑 Erick & Gui (Líder Técnico / Arquiteto)
- [ ] **(Seg-Qua)** Codificar a fundação do bot (Épico 1):
  - [ ] `index.js` com a conexão do Baileys.
  - [ ] `commandHandler.js` com lógica de carregamento de subpastas e verificação de grupo (whitelist).
- [ ] **(Qua-Dom)** Realizar a revisão final (Code Review) de todos os Pull Requests abertos pela equipe.
- [ ] **(Dom)** Gerenciar o processo de testes e preparar a versão final do MVP.

#### ⚔️ Narum & Ky (Desenvolvedores)
- [ ] **(Seg)** Realizar a revisão em grupo do código do protótipo para entender a lógica.
- [ ] **(Qua-Sex)** Adaptar e integrar a lógica do `/registrar` no novo arquivo `commands/recrutamento/registrar.js`.
- [ ] **(Sex-Sab)** Desenvolver os comandos de leitura `/andamento clas` e `/andamento players`.
- [ ] **(Sab-Dom)** Ficar de prontidão para corrigir os bugs reportados pela equipe de Q&A.

#### 📜 Angelo, Júpiter (Documentação e Q&A / Genins)
- [ ] **(Seg-Qua)** Criar a documentação funcional detalhada para os comandos: `/registrar`, `/andamento clas` e `/andamento players`.
- [ ] **(Qua-Sex)** Elaborar uma lista de casos de teste para cada comando (Ex: "O que acontece se o comando `/registrar` for usado sem responder a uma mensagem?").
- [ ] **(Sab-Dom)** Executar massivamente os testes no ambiente controlado e reportar todos os bugs como "Issues" no GitHub.

---

Vamos focar e fazer desta a nossa primeira grande vitória com o novo bot! 🚀
