/*
 * ARQUIVO: scripts/seed-db.js
 * * Responsabilidade: Popular o banco de dados SQLite 'recrutas.db'
 * com dados genéricos gerados pela biblioteca FakerJS.
 * Deve ser rodado manualmente pelos desenvolvedores após 'init-db.js'.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { fakerPT_BR: faker } = require('@faker-js/faker'); // Usa a localização PT_BR
const moment = require('moment-timezone');

// Carrega nossas configs para dados realistas
const clasConfig = require('../src/Configs/clas.json');
const patentesEmojis = require('../src/Configs/patentes_emojis.json');

// Pega os nomes dos clãs e os emojis de patente
const clanNames = Object.keys(clasConfig);
const patenteEmojiList = patentesEmojis;

// Caminho para o banco de dados
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'recrutas.db');

// --- Configuração ---
const NUMERO_DE_FICHAS = 20; // Quantos registros falsos criar
// --- Fim Configuração ---

// Conecta ao banco
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("[SeedDB] Erro ao conectar ao banco de dados:", err.message);
        process.exit(1);
    } else {
        console.log(`[SeedDB] Conectado ao banco de dados SQLite em: ${dbPath}`);
    }
});

// SQL Preparado (Prepared Statement) para inserção
// Usar placeholders (?) é mais seguro e eficiente
const insertSql = `
INSERT OR IGNORE INTO fichas (
    jid, nome, cla, emojiCla, recrutadoPorTexto,
    registradoPorJid, data, timestamp, vcard, displayName
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`; // 'OR IGNORE' evita erro se tentarmos inserir um JID que já existe

// Função auxiliar para gerar JID falso
const generateFakeJid = () => `${faker.phone.number('55449########')}@s.whatsapp.net`;

db.serialize(() => {
    // Prepara o statement uma vez
    const stmt = db.prepare(insertSql, (err) => {
        if (err) {
            console.error("[SeedDB] Erro ao preparar o statement SQL:", err.message);
            db.close(); // Fecha a conexão em caso de erro
            process.exit(1);
        }
    });

    console.log(`[SeedDB] Gerando e inserindo ${NUMERO_DE_FICHAS} fichas falsas...`);

    // Loop para gerar e inserir dados
    for (let i = 0; i < NUMERO_DE_FICHAS; i++) {
        // Gera dados falsos
        const fakeNome = faker.person.firstName() + ' ' + faker.person.lastName();
        const fakeClaName = faker.helpers.arrayElement(clanNames); // Pega um nome de clã aleatório
        const fakeEmojiCla = clasConfig[fakeClaName] || '';
        const fakeRecruiterName = faker.person.fullName();
        const fakePatenteEmoji = faker.helpers.arrayElement(patenteEmojiList); // Pega um emoji de patente aleatório
        const fakeRecrutadoPor = `${fakeRecruiterName} ${fakeEmojiCla} ${fakePatenteEmoji}`.trim(); // Monta recrutador semi-limpo
        const fakeRegistradoPorJid = generateFakeJid(); // JID falso do "admin"
        const fakeDate = faker.date.recent({ days: 30 }); // Data nos últimos 30 dias
        const fakeDataStr = moment(fakeDate).tz('America/Sao_Paulo').format('DD/MM/YYYY');
        const fakeTimestamp = fakeDate.getTime();
        const fakeJid = generateFakeJid();

        // Monta displayName e vCard (lógica similar ao database.js)
        const emojiDisplay = fakeEmojiCla ? `${fakeEmojiCla} ` : '';
        const fakeDisplayName = `📚 ${emojiDisplay}${fakeNome} ${fakeClaName} ${fakeDataStr}`.trim().replace(/\s+/g, ' ');
        const waid = fakeJid.split('@')[0];
        const fakeVcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${fakeDisplayName};;;\nFN:${fakeDisplayName}\nitem1.TEL;waid=${waid}:${waid}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`;

        // Array com os valores na ordem dos placeholders (?)
        const params = [
            fakeJid,
            fakeNome,
            fakeClaName,
            fakeEmojiCla,
            fakeRecrutadoPor,
            fakeRegistradoPorJid,
            fakeDataStr,
            fakeTimestamp,
            fakeVcard,
            fakeDisplayName
        ];

        // Executa o statement com os dados gerados
        stmt.run(params, (err) => {
            if (err) {
                // 'OR IGNORE' deve prevenir a maioria dos erros, mas loga se ocorrer
                console.warn(`[SeedDB] Aviso ao inserir ficha ${i + 1}:`, err.message);
            }
        });
    }

    // Finaliza o statement após o loop
    stmt.finalize((err) => {
        if (err) {
            console.error("[SeedDB] Erro ao finalizar o statement:", err.message);
        } else {
            console.log(`[SeedDB] ${NUMERO_DE_FICHAS} fichas inseridas (ou ignoradas se JID já existia).`);
        }

        // Fecha a conexão com o banco
        db.close((err) => {
            if (err) {
                console.error("[SeedDB] Erro ao fechar a conexão com o banco:", err.message);
            } else {
                console.log("[SeedDB] Conexão com o banco fechada.");
            }
        });
    });
});