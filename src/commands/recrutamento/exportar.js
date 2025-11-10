// src/commands/recrutamento/exportar.js
const db = require('../../../utils/database.js');
const { parseExportarArgs } = require('./parsers.js');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

/**
 * Lógica do comando !exportar
 */
async function executarExportarContatos(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    // 1. Delega a análise dos argumentos para o parser
    const { startTimestamp, endTimestamp, periodTitle, periodFile } = parseExportarArgs(args);
    
    // 2. Busca no DB (assumindo que o DB pode filtrar por timestamp)
    const fichasArray = await db.getFichasByTimestamp(startTimestamp, endTimestamp); 

    if (fichasArray.length === 0) {
        throw new Error(`Nenhuma ficha encontrada no período: ${periodTitle}.`);
    }
    
    // 3. Agrupa as fichas por Clã
    const fichasPorCla = {};
    for (const ficha of fichasArray) {
        const cla = ficha.cla || 'Sem Cla';
        if (!fichasPorCla[cla]) {
            fichasPorCla[cla] = [];
        }
        fichasPorCla[cla].push(ficha);
    }
    
    await sock.sendMessage(from, { text: `ℹ️ Encontrados ${Object.keys(fichasPorCla).length} clãs com fichas no período ${periodTitle}. Preparando arquivos...` }, { quoted: msg });
    
    // 4. Define o diretório temporário (dentro da pasta do projeto)
    const tempDir = path.join(__dirname, '../../../temp'); // Sobe 3 níveis (commands/recrutamento/ -> src/ -> raiz) e entra em /temp
    if (!fs.existsSync(tempDir)) { 
        fs.mkdirSync(tempDir, { recursive: true }); 
    }
    
    let arquivosEnviados = 0;
    const dataHoje = moment().tz('America/Sao_Paulo').format('DD-MM-YYYY');

    // 5. Itera, cria o VCard de cada clã e envia
    for (const claNome in fichasPorCla) {
        const fichasDoCla = fichasPorCla[claNome];
        
        // Pega todos os VCards daquele clã e junta em um único arquivo
        const vcfContent = fichasDoCla.map(f => f.vcard).filter(Boolean).join('\n\n');
        
        if (!vcfContent) {
            console.warn(`[Exportar] Clã ${claNome} não possui dados VCard, pulando...`);
            continue; // Pula para o próximo clã se não houver VCards
        }

        const emoji = fichasDoCla[0]?.emojiCla || '❓';
        const claNomeSanitizado = claNome.replace(/[^a-z0-9_-]/gi, '_');
        const fileName = `${emoji}_${claNomeSanitizado}_${periodFile}_${dataHoje}.vcf`;
        const caption = `📦 Contatos do Clã: *${claNome}*\n📋 Total: ${fichasDoCla.length} recrutas\n🗓️ Período: ${periodTitle}`;
        
        // Salva o VCard temporariamente
        const tempFilePath = path.join(tempDir, `${claNomeSanitizado}_${Date.now()}.vcf`);
        fs.writeFileSync(tempFilePath, vcfContent + '\n', 'utf8');

        // Envia o arquivo como documento
        await sock.sendMessage(from, {
            document: fs.readFileSync(tempFilePath),
            fileName: fileName,
            mimetype: 'text/vcard', // Mimetype correto para VCards
            caption: caption
        }, { quoted: msg });

        // Apaga o arquivo temporário
        fs.unlinkSync(tempFilePath);
        
        arquivosEnviados++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Pausa de 0.5s para não flodar
    }
    
    await sock.sendMessage(from, { text: `✅ Exportação concluída! Foram enviados ${arquivosEnviados} arquivos .vcf.` }, { quoted: msg });
}

module.exports = { executarExportarContatos };