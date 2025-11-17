/*
 * ARQUIVO: src/handlers/api_server.js
 * Responsabilidade: Servidor Express (API Gateway) para a DIJ.
 *
 * v3.0 - Refatorado para modularidade, com monitoramento e Swagger isolados.
 */

const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");
const os = require("os");
const client = require("prom-client");
const db = require("../../utils/database.js");

// -----------------------------------------------------------------------------
// ⚙️ CONFIGURAÇÃO BÁSICA
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.disable("x-powered-by");

// -----------------------------------------------------------------------------
// 📘 SWAGGER CONFIG
// -----------------------------------------------------------------------------
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "API do Bot Abelhinha (DIJ)",
    version: "1.0.0",
    description:
      "API Gateway para a Divisão de Inteligência de Jogo (DIJ). Permite consultar dados do RPG.",
  },
  servers: [
    { url: `http://localhost:${PORT}`, description: "Servidor Local" },
  ],
};

const swaggerSpec = swaggerJSDoc({
  swaggerDefinition,
  apis: ["./src/handlers/api_server.js"],
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// -----------------------------------------------------------------------------
// 📊 MONITORAMENTO / METRICS
// -----------------------------------------------------------------------------
client.collectDefaultMetrics({ prefix: "abelhinha_", timeout: 5000 });

// Healthcheck simples (usado pelo Docker e por você)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: "DIJ API Gateway",
    uptime: process.uptime(),
    memoryMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
    loadavg: os.loadavg(),
    timestamp: new Date().toISOString(),
  });
});

// Exposição de métricas Prometheus (opcional, mas útil)
app.get("/api/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

// -----------------------------------------------------------------------------
// 📦 ENDPOINTS PRINCIPAIS
// -----------------------------------------------------------------------------

// 1️⃣ Dados de Recrutamento (sem JIDs)
app.get("/api/dados/recrutamento", async (_req, res) => {
  try {
    const fichasObj = await db.getAllFichas();
    const fichasArray = Object.values(fichasObj);

    const dadosSeguros = fichasArray.map((ficha) => ({
      nome: ficha.nome,
      cla: ficha.cla,
      emojiCla: ficha.emojiCla,
      recrutadoPorTexto: ficha.recrutadoPorTexto,
      data: ficha.data,
      timestamp: ficha.timestamp,
    }));

    res.status(200).json({ total: dadosSeguros.length, data: dadosSeguros });
  } catch (e) {
    console.error("[API ERROR] Falha ao buscar dados de recrutamento:", e);
    res.status(500).json({ error: "Erro interno ao buscar dados." });
  }
});

// 2️⃣ Dados de Missões Concluídas
app.get("/api/dados/missoes-concluidas", async (_req, res) => {
  try {
    const missoesArray = await db.getMissoesConcluidas(50);
    res.status(200).json({ total: missoesArray.length, data: missoesArray });
  } catch (e) {
    console.error("[API ERROR] Falha ao buscar missões:", e);
    res.status(500).json({ error: "Erro interno ao buscar missões." });
  }
});

// -----------------------------------------------------------------------------
// 🚀 FUNÇÃO DE INICIALIZAÇÃO
// -----------------------------------------------------------------------------
function startAPIServer() {
  try {
    app
      .listen(PORT, () => {
        console.log(`[API Server] Servidor rodando na porta ${PORT}`);
        console.log(
          `[API Server] Documentação disponível em http://localhost:${PORT}/api/docs`
        );
      })
      .on("error", (err) => {
        console.error(`[API Server] Erro ao iniciar servidor:`, err.message);
      });
  } catch (e) {
    console.error(`[API Server] Erro catastrófico ao iniciar:`, e);
  }
}

module.exports = { startAPIServer };
