/*
 * ARQUIVO: src/handlers/recrutamentoHandler.js
 * * Responsabilidade: Contém toda a lógica relacionada
 * ao recrutamento de jogadores via fichas enviadas no WhatsApp.
 * Histórias de Usuário Atendidas:
 * 2.1: Restringir comandos a grupos específicos.
 * 2.2: Implementar o comando /registrar <número> (respondendo à ficha).
 * 2.3: Implementar o comando /andamento clas.
 * 2.4: Implementar o comando /andamento players.
 * 2.5: Implementar o comando /exportar (enviar contatos por clã).
 * É importante notar que este handler é Adicionado     
 * ao roteador de comandos em src/routes.js.
 * v1.8: Adicionado comando !menu para admins.
*/

// Importa nossos módulos utilitários
const parser = require('../../utils/parser.js');
const db = require('../../utils/database.js');
const config = require('../configs/ids-groups.json');
const { checkAdmin } = require('../../utils/common.js')

// Importa libs
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// --- Função auxiliar: gerar vCard simples (fallback) ---
function gerarVCardFallback(nome, numero) {
    const tel = (numero || '').replace(/[^0-9]/g, '');
    const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${nome || ''}`
    ];
    if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
    lines.push('END:VCARD');
    return lines.join('\n');
}
// --- Fim gerarVCardFallback ---

/**
 * O Handler Principal de Recrutamento
*/
async function handlerRecrutamento(sock, msg, text) {
    const info = msg;
    const from = info.key.remoteJid;

    // --- 1. Verificação de Escopo (História 2.1) ---
    if (!config.allowedRecruitmentGroups.includes(from)) {
        return;
    }

    // --- 2. Extração de Comando e Argumentos ---
    const args = text.split(' ').slice(1);
    const command = text.split(' ')[0].toLowerCase();

    // --- 3. Roteamento de Sub-Comandos ---
    switch (command) {
        case '!processar':
        case '!registrar':
            await executarRegistrar(sock, info, args, text);
            break;

        case '!andamento':
            await executarAndamento(sock, info, args);
            break;

        case '!exportar':
        case '!enviarcontatos':
            await executarExportarContatos(sock, info, args);
            break;
        // --- NOVA ROTA PARA O MENU DE ADMIN ---
        case '!menu':
        case '!ajuda':
        case '!comandos': // Adiciona mais aliases se quiser
            await executarMenuAdmin(sock, info, args);
            break;
        // --- FIM DA NOVA ROTA ---
    }
}

/*
 * Lógica do comando !processar
 * v1.11 - Implementada separação por nova linha (\n) entre número e overrides.
 * Formato Esperado:
 * !processar <numero com espaços/etc>
 * [opcional: overrides chave=valor na(s) linha(s) seguinte(s)]
 */
async function executarRegistrar(sock, info, args, text) { // args não é mais usado diretamente para parsing principal
    const from = info.key.remoteJid;
    try {
        const isAdmin = await checkAdmin(sock, info);
        if (!isAdmin) {
             await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
            return;
        }

        const ctx = info.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        // --- MUDANÇA: Extração de Número e Overrides com Base em Linhas ---

        // 1. Separa o texto completo em linhas
        const lines = text.trim().split('\n');
        const firstLine = lines[0].trim(); // Linha do comando e número
        // Junta todas as linhas *depois* da primeira, separadas por espaço, para parsing dos overrides
        const overrideLinesString = lines.length > 1 ? lines.slice(1).join(' ').trim() : ''; 

        // 2. Extrai o comando e o número da *primeira linha*
        const commandParts = firstLine.split(' ');
        // Pega TUDO depois do primeiro espaço como parte do número
        const numberInput = commandParts.length > 1 ? commandParts.slice(1).join(' ').trim() : ''; 

        // 3. Limpa e valida o número
        const numeroLimpo = (numberInput || '').replace(/[^0-9]/g, '');
        if (numeroLimpo.length < 8) {
            await sock.sendMessage(from, { text: '⚠ Número de celular inválido ou não encontrado na primeira linha.\nEx:\n!processar +55 43 9999-8888\ncla=Exemplo' }, { quoted: info });
            return;
        }
        const targetJid = `${numeroLimpo}@s.whatsapp.net`;

        // 4. Extrai os overrides da string formada pela(s) linha(s) *seguinte(s)*
        const overrides = {};
        const camposPermitidos = ['nome', 'cla', 'recrutadopor'];
        if (overrideLinesString) { // Só processa se houver linhas de override
            const overrideRegex = /(\w+)=("([^"]+)"|'([^']+)'|(\S+))/g;
            let match;
            while ((match = overrideRegex.exec(overrideLinesString)) !== null) {
                const key = match[1].trim().toLowerCase();
                const value = match[3] || match[4] || match[5];
                if (value && camposPermitidos.includes(key)) {
                    const finalKey = key === 'recrutadopor' ? 'recrutadoPorTexto' : key;
                    overrides[finalKey] = value.trim();
                }
            }
        }
        console.log("[Registrar] Número Input:", numberInput);
        console.log("[Registrar] Overrides encontrados:", overrides);
        // --- FIM DA MUDANÇA ---

        // --- LÓGICA AJUSTADA PARA DETERMINAR textoFicha e autorDaFichaJid ---
        let textoFicha = '';
        let autorDaFichaJid = null;

        if (quoted) {
            // Cenário 1: Resposta (Sempre pega texto da resposta como base)
            textoFicha = parser.extractText(quoted);
            autorDaFichaJid = ctx?.participant;
            // Validação do autor da ficha original (se aplicável e necessário)
            // if (!autorDaFichaJid) { /* ... (erro autor) ... */ return; } // Removido - Deixa o parser lidar
        } else if (Object.keys(overrides).length > 0) {
            // Cenário 2: Sem resposta, MAS com overrides. Ficha base é vazia.
            textoFicha = ''; // Força depender dos overrides
            autorDaFichaJid = null;
        } else {
            // Cenário 3: Sem resposta E SEM overrides. Erro.
            await sock.sendMessage(from, { text: '⚠ Comando inválido. Use respondendo a uma ficha OU forneça overrides na linha abaixo (ex:\ncla=...).' }, { quoted: info });
            return;
        }
        // --- FIM DA LÓGICA AJUSTADA ---


        // --- Processar a Ficha Base ---
        await sock.sendMessage(from, { react: { text: '🛠️', key: info.key } });
        const dadosParseados = parser.parseFicha(textoFicha); // Pode receber texto vazio

        // Verifica erro do parser SOMENTE se o campo específico não foi fornecido no override
        if (dadosParseados.error) {
             if (dadosParseados.error.includes('Nome') && !overrides.nome) {
                 await sock.sendMessage(from, { react: { text: '❌', key: info.key } });
                 await sock.sendMessage(from, { text: `❌ Erro: ${dadosParseados.error}. Forneça o nome (ex:\nnome=Fulano).` }, { quoted: info });
                 return;
             }
             console.log("[Registrar] Erro do parser base ignorado devido a overrides:", dadosParseados.error);
        }

        // Aplica Overrides e Normaliza/Limpa
        let dadosFinais = {
            nome: dadosParseados.nome,
            cla: dadosParseados.cla,
            emojiCla: dadosParseados.emojiCla,
            recrutadoPorTexto: dadosParseados.recrutadoPorTexto,
            ...overrides // Aplica os overrides por cima
        };

        // Se o CLÃ foi sobrescrito, re-normaliza ele
        if (overrides.cla) {
            const { claEncontrado, emojiCla } = parser.normalizeCla(overrides.cla);
            dadosFinais.cla = claEncontrado;
            dadosFinais.emojiCla = emojiCla;
        }
        // Se o RECRUTADOR foi sobrescrito, re-limpa ele
        if (overrides.recrutadoPorTexto) {
            dadosFinais.recrutadoPorTexto = parser.normalizeRecruiterNameLight(overrides.recrutadoPorTexto);
        }

        // Validação final: Nome e Clã são obrigatórios
        if (!dadosFinais.nome || !dadosFinais.cla) {
              await sock.sendMessage(from, { react: { text: '❌', key: info.key } });
              await sock.sendMessage(from, { text: `❌ Erro: Campos obrigatórios faltando. Verifique Nome e Clã (pode usar cla=...).` }, { quoted: info });
              return;
        }

        // --- Preparar Dados para Salvar ---
        const dadosParaSalvar = {
            nome: dadosFinais.nome,
            cla: dadosFinais.cla,
            emojiCla: dadosFinais.emojiCla,
            recrutadoPorTexto: dadosFinais.recrutadoPorTexto || 'Não informado',
            registradoPorJid: info.key.participant || info.key.remoteJid,
            data: moment().tz('America/Sao_Paulo').format('DD/MM/YYYY')
        };

        // --- Salvar no Banco de Dados (SQLite async) ---
        const fichaParaSalvar = {
            ...dadosParaSalvar,
            timestamp: Date.now(),
            vcard: dadosParseados.vcard || gerarVCardFallback(dadosParaSalvar.nome, numeroLimpo)
        };

        try {
            await db.saveFicha(targetJid, fichaParaSalvar);
        } catch (eSave) {
            console.error("Erro ao salvar ficha no DB:", eSave);
            await sock.sendMessage(from, { text: '❌ Falha ao salvar a ficha no banco de dados.' }, { quoted: info });
            return;
        }

        // --- Feedback e Ação Final (Remover) ---
        await sock.sendMessage(from, { react: { text: '✅', key: info.key } });
        await sock.sendMessage(from, {
            text: `✅ Ficha de *${dadosParaSalvar.nome}* processada com sucesso!\n*Número:* ${targetJid.split('@')[0]}\n*Clã:* ${dadosParaSalvar.cla} ${dadosParaSalvar.emojiCla}\n*Recrutado por:* ${dadosParaSalvar.recrutadoPorTexto}`
        }, { quoted: info });

        if (autorDaFichaJid) {
            try {
                await sock.sendMessage(from, { text: `ℹ️ Removendo @${autorDaFichaJid.split('@')[0]} do grupo...`, mentions: [autorDaFichaJid] });
                await sock.groupParticipantsUpdate(from, [autorDaFichaJid], 'remove'); // Comentado para testes
            } catch (e) {
                console.error('Falha ao remover recruta:', e);
                await sock.sendMessage(from, { text: `⚠ Falha ao remover @${autorDaFichaJid.split('@')[0]}. Verifique minhas permissões.`, mentions: [autorDaFichaJid] });
            }
        }

    } catch (err) {
        console.error("Erro em executarRegistrar:", err);
        await sock.sendMessage(from, { text: `❌ Ocorreu um erro interno no comando !processar.` }, { quoted: info });
    }
}

/**
 * Lógica do comando !andamento (Final e Robusto)
 * Filtra dados por Missão Atual, Última Missão ou Período Específico.
 */
async function executarAndamento(sock, info, args) {
    const from = info.key.remoteJid;
    const subComando = args[0]?.toLowerCase();

    try {
        const isAdmin = await checkAdmin(sock, info);
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
            return;
        }

        // --- Variáveis de Período ---
        const now = moment().tz('America/Sao_Paulo');
        const dayOfWeek = now.isoWeekday(); // 1 (Segunda) a 7 (Domingo)

        let startOfPeriod, endOfPeriod, periodTitle;
        const dateRangeArg = args[1]; // Opcional: filtro de data específica

        // 1. Cenário: Data Específica Fornecida (Prioridade 1)
        if (dateRangeArg && dateRangeArg.includes('-') && dateRangeArg.match(/^\d{2}\/\d{2}\/\d{4}-\d{2}\/\d{2}\/\d{4}$/)) {
            const [inicioStr, fimStr] = dateRangeArg.split('-');
            startOfPeriod = moment.tz(inicioStr, "DD/MM/YYYY", "America/Sao_Paulo").startOf('day');
            endOfPeriod = moment.tz(fimStr, "DD/MM/YYYY", "America/Sao_Paulo").endOf('day');

            if (!startOfPeriod.isValid() || !endOfPeriod.isValid() || startOfPeriod.isAfter(endOfPeriod)) {
                await sock.sendMessage(from, { text: '⚠ Formato de data inválido ou data de início posterior à data de fim. Use DD/MM/YYYY-DD/MM/YYYY.' }, { quoted: info });
                return;
            }
            periodTitle = `Período Específico (${startOfPeriod.format('DD/MM/YY')} a ${endOfPeriod.format('DD/MM/YY')})`;
        } else {
            // 2. Cenário: Lógica da Missão Semanal (FALLBACK)
            
            if (dayOfWeek >= 1 && dayOfWeek <= 2) { // Segunda ou Terça -> Missão Atual
                startOfPeriod = now.clone().isoWeekday(1).startOf('day');
                endOfPeriod = now.clone().isoWeekday(2).endOf('day');
                periodTitle = `Missão Atual (Seg-Ter - ${startOfPeriod.format('DD/MM')} a ${endOfPeriod.format('DD/MM')})`;
            } else if (dayOfWeek >= 4 && dayOfWeek <= 5) { // Quinta ou Sexta -> Missão Atual
                startOfPeriod = now.clone().isoWeekday(4).startOf('day');
                endOfPeriod = now.clone().isoWeekday(5).endOf('day');
                periodTitle = `Missão Atual (Qui-Sex - ${startOfPeriod.format('DD/MM')} a ${endOfPeriod.format('DD/MM')})`;
            } else { 
                // 3. Cenário: Dias de Folga/Transição (Sábado, Domingo, Quarta) -> Última Missão
                let targetDayStart = dayOfWeek === 3 ? 1 : 4; // 1=Seg ou 4=Qui
                let targetDayEnd = dayOfWeek === 3 ? 2 : 5;   // 2=Ter ou 5=Sex
                let basePeriodName = dayOfWeek === 3 ? 'Seg-Ter' : 'Qui-Sex';
                
                startOfPeriod = now.clone().isoWeekday(targetDayStart).startOf('day');
                endOfPeriod = now.clone().isoWeekday(targetDayEnd).endOf('day');

                // --- CORREÇÃO FINAL: Garante que a data seja da semana passada ---
                // Se o período calculado está no futuro (comparado a AGORA),
                // ou se estamos em um dia de folga, subtraímos 7 dias.
                // O mais seguro é assumir que fora do período ativo (Seg-Ter, Qui-Sex),
                // olhamos para a semana anterior.
                // Ajuste: A lógica correta é subtrair 7 dias se o dia atual for FORA da janela de missão.
                if (dayOfWeek === 3 || dayOfWeek === 6 || dayOfWeek === 7) { 
                    startOfPeriod.subtract(7, 'days');
                    endOfPeriod.subtract(7, 'days');
                }
                
                periodTitle = `Última Missão (${basePeriodName} - ${startOfPeriod.format('DD/MM')} a ${endOfPeriod.format('DD/MM')})`;
            }
        }

        const startTimestamp = startOfPeriod.valueOf();
        const endTimestamp = endOfPeriod.valueOf();
        
        console.log(`[Andamento] Período calculado: ${periodTitle}`);


        // --- BUSCA NO BANCO DE DADOS (COM FILTRO) ---
        const fichasArray = await db.getFichasByTimestamp(startTimestamp, endTimestamp); 
        // --- FIM DA BUSCA ---

        // Validação se encontrou fichas NO PERÍODO
        if (!fichasArray || fichasArray.length === 0) {
            await sock.sendMessage(from, { text: `ℹ️ Nenhuma ficha encontrada para o período selecionado (${periodTitle}).` }, { quoted: info });
            return;
        }

        // --- Processamento e Exibição ---
        if (subComando === 'clas') {
            const contagem = {};
            // --- Loop de Contagem ---
            for (const ficha of fichasArray) {
                const cla = ficha.cla || 'Sem Clã';
                contagem[cla] = (contagem[cla] || 0) + 1;
            }

            let resposta = `📊 *Andamento por Clã (${periodTitle})*\n\n`;
            const clasOrdenados = Object.entries(contagem).sort(([, a], [, b]) => b - a);

            // --- Loop de Formatação ---
            for (const [cla, total] of clasOrdenados) {
                const emoji = fichasArray.find(f => fichasArray.find(f => f.cla === cla))?.emojiCla || '❓';
                resposta += `${emoji} *${cla}:* ${total} recrutas\n`;
            }

            resposta += `\n*Total no Período:* ${fichasArray.length} fichas.`;
            await sock.sendMessage(from, { text: resposta }, { quoted: info });

        } else if (subComando === 'players') {
            const contagemPorRecrutador = {};
            // --- Loop de Contagem ---
            for (const ficha of fichasArray) {
                const recrutadorNome = ficha.recrutadoPorTexto || 'Não Informado';
                contagemPorRecrutador[recrutadorNome] = (contagemPorRecrutador[recrutadorNome] || 0) + 1;
            }

            let resposta = `📈 *Recrutamento por Player (${periodTitle})*\n_(Quem indicou o recruta)_\n\n`;
            const recrutadoresOrdenados = Object.entries(contagemPorRecrutador).sort(([, a], [, b]) => b - a);

            // --- Loop de Formatação ---
            for (const [nomeRecrutador, total] of recrutadoresOrdenados) {
                resposta += `👥 *${nomeRecrutador}:* ${total} recrutas\n`;
            }

            resposta += `\n*Total no Período:* ${fichasArray.length} fichas.`;
            await sock.sendMessage(from, { text: resposta }, { quoted: info });
        } else {
            // Nenhum sub-comando válido
            await sock.sendMessage(from, { text: '⚠ Comando inválido. Use:\n*!andamento clas*\n*!andamento players*' }, { quoted: info });
        }

    } catch (err) {
        console.error("Erro em executarAndamento:", err);
        await sock.sendMessage(from, { text: `❌ Ocorreu um erro interno no comando !andamento.` }, { quoted: info });
    }
}

/**
 * Lógica do comando !exportar
 * Envia arquivos .vcf separados por clã, com filtro de data opcional.
 */
async function executarExportarContatos(sock, info, args) {
    const from = info.key.remoteJid;

    try {
        const isAdmin = await checkAdmin(sock, info);
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
            return;
        }

        // --- MUDANÇA: agora await para DB async ---
        const fichas = await db.getAllFichas();
        let fichasArray = Array.isArray(fichas) ? fichas : Object.values(fichas); // Usa 'let' para poder reatribuir

        if (fichasArray.length === 0) {
            await sock.sendMessage(from, { text: 'ℹ️ Nenhuma ficha foi processada ainda para exportar.' }, { quoted: info });
            return;
        }

        // --- NOVA LÓGICA: FILTRO DE DATA ---
        let dataInicio = null;
        let dataFim = null;
        let periodoStr = "Tudo"; // Padrão

        const dateRangeArg = args[0]; // Pega o primeiro argumento (pode ser a data)

        if (dateRangeArg && dateRangeArg.includes('-') && dateRangeArg.match(/^\d{2}\/\d{2}\/\d{4}-\d{2}\/\d{2}\/\d{4}$/)) {
            const [inicioStr, fimStr] = dateRangeArg.split('-');

            // Usa moment para analisar as datas no fuso horário correto e valida
            dataInicio = moment.tz(inicioStr, "DD/MM/YYYY", "America/Sao_Paulo").startOf('day');
            dataFim = moment.tz(fimStr, "DD/MM/YYYY", "America/Sao_Paulo").endOf('day'); // Pega até o fim do dia

            if (!dataInicio.isValid() || !dataFim.isValid()) {
                await sock.sendMessage(from, { text: '⚠ Formato de data inválido. Use DD/MM/YYYY-DD/MM/YYYY.' }, { quoted: info });
                return;
            }
            if (dataInicio.isAfter(dataFim)) {
                 await sock.sendMessage(from, { text: '⚠ A data de início não pode ser depois da data de fim.' }, { quoted: info });
                return;
            }

            // Filtra o array de fichas
            fichasArray = fichasArray.filter(ficha => {
                // Compara usando o timestamp salvo (mais preciso)
                const fichaTimestamp = ficha.timestamp;
                return fichaTimestamp >= dataInicio.valueOf() && fichaTimestamp <= dataFim.valueOf();
            });

            periodoStr = `de ${dataInicio.format("DD/MM/YY")} a ${dataFim.format("DD/MM/YY")}`;

            if (fichasArray.length === 0) {
                await sock.sendMessage(from, { text: `ℹ️ Nenhuma ficha encontrada no período de ${periodoStr}.` }, { quoted: info });
                return;
            }

            await sock.sendMessage(from, { text: `🔍 Filtrando exportação para o período: ${periodoStr}...`}, { quoted: info });
        }

        // --- 1. Agrupar Fichas (filtradas ou não) por Clã ---
        const fichasPorCla = {};
        for (const ficha of fichasArray) { // Agora usa o array potencialmente filtrado
            const cla = ficha.cla || 'Sem Cla';
            if (!fichasPorCla[cla]) {
                fichasPorCla[cla] = [];
            }
            fichasPorCla[cla].push(ficha);
        }

        const totalClas = Object.keys(fichasPorCla).length;
        if (totalClas === 0) { // Pode acontecer se o filtro não retornar nada
             await sock.sendMessage(from, { text: `ℹ️ Nenhuma ficha encontrada${dataInicio ? ' no período especificado' : ''}.` }, { quoted: info });
             return;
        }

        await sock.sendMessage(from, { text: `ℹ️ Encontrados ${totalClas} clãs com fichas ${dataInicio ? `no período de ${periodoStr}` : 'no total'}. Preparando arquivos...` }, { quoted: info });

        // --- 2. Preparar Diretório Temporário ---
        const tempDir = '/app/temp';
        if (!fs.existsSync(tempDir)) { fs.mkdirSync(tempDir); }

        let arquivosEnviados = 0;
        const dataHoje = moment().tz('America/Sao_Paulo').format('DD-MM-YYYY');

        // --- 3. Iterar por cada Clã e Enviar o Arquivo ---
        for (const claNome in fichasPorCla) {
            const fichasDoCla = fichasPorCla[claNome];
            const totalRecrutas = fichasDoCla.length;
            // if (totalRecrutas === 0) continue; // Não é mais necessário, já filtramos antes

            const vcfContent = fichasDoCla.map(f => f.vcard).filter(Boolean).join('\n');
            if (!vcfContent) { /* ... (warning) ... */ continue; }

            // --- 4. Criar Nome de Arquivo e Legenda ---
            const emoji = fichasDoCla[0]?.emojiCla || '❓'; // Pega emoji da primeira ficha do clã
            const claNomeSanitizado = claNome.replace(/[^a-z0-9_-]/gi, '_');
            // Adiciona o período ao nome do arquivo se houver filtro
            const periodoArquivo = dataInicio ? `_${dataInicio.format("DDMMYY")}-${dataFim.format("DDMMYY")}` : '';
            const fileName = `${emoji}_${claNomeSanitizado}${periodoArquivo}_${dataHoje}.vcf`;
            const caption = `📦 Contatos do Clã: *${claNome}*\n📋 Total de Recrutas${dataInicio ? ` (${periodoStr})` : ''}: ${totalRecrutas}`;

            // --- 5. Salvar e Enviar ---
            const tempFilePath = path.join(tempDir, `${claNomeSanitizado}_${Date.now()}.vcf`);
            fs.writeFileSync(tempFilePath, vcfContent + '\n', 'utf8');

            await sock.sendMessage(from, {
                document: fs.readFileSync(tempFilePath),
                fileName: fileName,
                mimetype: 'text/x-vcard',
                caption: caption
            }, { quoted: info });

            fs.unlinkSync(tempFilePath);
            arquivosEnviados++;
            await new Promise(resolve => setTimeout(resolve, 500)); // Pequena pausa para evitar flood
        }

        // --- 6. Feedback Final ---
        await sock.sendMessage(from, { text: `✅ Exportação concluída! Foram enviados ${arquivosEnviados} arquivos .vcf ${dataInicio ? `referentes ao período ${periodoStr}` : 'com todos os contatos'}.` }, { quoted: info });

    } catch (err) {
        console.error("Erro em executarExportarContatos:", err);
        await sock.sendMessage(from, { text: `❌ Ocorreu um erro interno ao exportar os contatos.` }, { quoted: info });
    }
}

/**
 * Exibe o menu de ajuda com os comandos do módulo de recrutamento.
 */
async function executarMenuAdmin(sock, info, args) {
    const from = info.key.remoteJid;

    try {
        const isAdmin = await checkAdmin(sock, info);
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
            return;
        }

        // --- TEXTO DO MENU REFORMATADO ---
        const helpText = `
•➖➖❰✨ ⟦• ✞ ❲🕉❳ ✞ •⟧ ✨❱➖➖•

    🕉❰✨\` Bot Recrutamento \`✨❱🕉

    📌• 📰 ❪ Menu de Comandos ❫ 📰 •📌

•➖➖❰✨ ⟦• ✞ ❲🕉❳ ✞ •⟧ ✨❱➖➖•

🐝 *Comandos Disponíveis (Admins):* 🐝

*1. Processar Ficha:*
   Salva o recruta, formata o contato e remove do grupo.

   *Modo Resposta:*
   \`\`\`!processar <número_completo>\`\`\`
   _(Responda à ficha)_

   *Modo Override:*
   \`\`\`!processar <número_completo> [campo=valor]\`\`\`
   _(Ex: cla=Uchiha nome="Novo Nome")_
   _(Campos: nome, cla, recrutadopor)_

*2. Ver Andamento:*
   Mostra estatísticas.

   *Contagem por Clã:*
   \`\`\`!andamento clas\`\`\`

   *Contagem por Recrutador (Indicador):*
   \`\`\`!andamento players\`\`\`

*3. Exportar Contatos:*
   Envia arquivos .VCF por clã.

   *Exportar Todos:*
   \`\`\`!exportar\`\`\`

   *Exportar por Período:*
   \`\`\`!exportar DD/MM/YYYY-DD/MM/YYYY\`\`\`

*4. Ajuda:*
   Mostra este menu.
   \`\`\`!menu\`\`\` ou \`\`\`!ajuda\`\`\`

•➖➖❰✨ ⟦• ✞ ❲🕉❳ ✞ •⟧ ✨❱➖➖•
• ครร : ✒
🖥️❰°🤖 Setor de TI 🤖°❱🖥️
        `;
        // --- FIM DO TEXTO REFORMATADO ---

        await sock.sendMessage(from, { text: helpText.trim() }, { quoted: info });

    } catch (err) {
        console.error("Erro em executarMenuAdmin:", err);
        try {
            await sock.sendMessage(from, { text: `❌ Ocorreu um erro ao exibir o menu de ajuda.` }, { quoted: info });
        } catch (e2) {}
    }
}

// Exporta o handler principal que o messageRouter vai chamar
module.exports = { handlerRecrutamento };