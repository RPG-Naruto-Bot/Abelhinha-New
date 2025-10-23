/*
 * ARQUIVO: src/Handlers/recrutamentoHandler.js
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
const parser = require('../../Utils/parser.js');
const db = require('../../Utils/database.js');
const config = require('../Configs/ids-groups.json');

// Importa libs
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// --- Funções Auxiliares (Mockups) ---
// --- Função checkAdmin ATUALIZADA com Logs ---
const checkAdmin = async (sock, msg) => {
    const groupId = msg.key.remoteJid;
    // Garante que só execute em grupos
    if (!groupId || !groupId.endsWith('@g.us')) {
        console.log('[checkAdmin] Ignorado: Não é uma mensagem de grupo.');
        return false;
    }

    const senderJid = msg.key.participant || msg.key.remoteJid; // Quem enviou

    console.log(`[checkAdmin] Verificando admin status para ${senderJid} no grupo ${groupId}`);

    try {
        // Busca os metadados do grupo
        const groupMetadata = await sock.groupMetadata(groupId);
        
        // Encontra as informações do participante específico
        const participantInfo = groupMetadata.participants.find(p => p.id === senderJid);

        if (!participantInfo) {
            console.warn(`[checkAdmin] ALERTA: Não foi possível encontrar informações do participante ${senderJid} na lista do grupo.`);
            return false; // Se não achou o participante, não pode ser admin
        }

        // --- DEBUG DETALHADO ---
        console.log(`[checkAdmin] Info do participante ${senderJid}:`, participantInfo);
        console.log(`[checkAdmin] Valor da propriedade 'admin':`, participantInfo.admin); 
        // --- FIM DO DEBUG ---

        // A lógica de verificação (padrão Baileys)
        const isAdmin = participantInfo.admin === 'admin' || participantInfo.admin === 'superadmin';
        
        console.log(`[checkAdmin] Resultado da verificação para ${senderJid}: ${isAdmin}`);
        
        return isAdmin; // Retorna true se for 'admin' ou 'superadmin', false caso contrário (incluindo null/undefined)

    } catch (e) {
        // Se der erro (ex: bot não está mais no grupo, API mudou), assume que não é admin
        console.error("[checkAdmin] ERRO ao buscar metadados ou verificar admin:", e.message || e);
        return false;
    }
};
// --- Fim da função checkAdmin ---

/**
 * O Handler Principal de Recrutamento
*/
async function handlerRecrutamento(sock, msg, text) {
    const info = msg;
    const from = info.key.remoteJid;

    // --- 1. Verificação de Escopo (História 2.1) ---
    if (!config.allowedRecruitmentGroups.includes(from)) {
        console.log(`[HandlerRecrutamento] Comando ignorado em grupo não permitido: ${from}`);
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

/**
 * Lógica do comando !processar (História 2.2 + Overrides)
 * v1.6 - Implementado parsing de override aprimorado com regex
 */
async function executarRegistrar(sock, info, args, text) {
    const from = info.key.remoteJid;
    try {
        const isAdmin = await checkAdmin(sock, info);
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
            return;
        }

        const ctx = info.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        // --- MUDANÇA: Parsing de Overrides Melhorado ---
        // 1. Pega o número
        const numeroLimpo = (args[0] || '').replace(/[^0-9]/g, '');
        if (numeroLimpo.length < 8) {
             await sock.sendMessage(from, { text: '⚠ Você precisa informar um número de celular válido.\nEx: !processar 5544912345678' }, { quoted: info });
            return;
         }
        const targetJid = `${numeroLimpo}@s.whatsapp.net`;

        // 2. Pega os argumentos para override
        const overrideArgs = args.slice(1);
        const overrides = {};
        const camposPermitidos = ['nome', 'cla', 'recrutadopor']; // Campos que podem ser sobrescritos

        // Junta os argumentos (ex: ['cla=Uzumaki', 'recrutadopor="Erick', 'Senju', '♓🈂️"'])
        // de volta em uma string e usa regex para extrair chave=valor (lidando com aspas)
        const argsString = overrideArgs.join(' ');
        // Regex: chave=valor OU chave="valor com espacos" OU chave='valor com espacos'
        const overrideRegex = /(\w+)=("([^"]+)"|'([^']+)'|(\S+))/g;
        let match;

        while ((match = overrideRegex.exec(argsString)) !== null) {
            // match[1] é a chave (ex: "cla")
            // match[3] é o valor dentro de aspas duplas
            // match[4] é o valor dentro de aspas simples
            // match[5] é o valor sem aspas
            const key = match[1].trim().toLowerCase();
            const value = match[3] || match[4] || match[5]; // Pega o valor correto

            if (value && camposPermitidos.includes(key)) {
                // Mapeia 'recrutadopor' para 'recrutadoPorTexto'
                const finalKey = key === 'recrutadopor' ? 'recrutadoPorTexto' : key;
                overrides[finalKey] = value.trim(); // Remove espaços extras das pontas do valor
            }
        }
        console.log("[Registrar] Overrides encontrados:", overrides); // Log para debug
        // --- FIM DA MUDANÇA ---


        // Definir Texto da Ficha e Autor
        let textoFicha = '';
        let autorDaFichaJid = null;

        if (quoted) {
            // Cenário 1: Resposta
            textoFicha = parser.extractText(quoted);
            autorDaFichaJid = ctx?.participant; // Pega o participante do contexto da resposta
            if (!autorDaFichaJid && Object.keys(overrides).length === 0 && !text.includes('\n')) {
                // Se não achou o autor da ficha original E não há overrides E não é modo manual
                await sock.sendMessage(from, { text: '⚠ Não consegui identificar o autor da ficha original. Tente novamente.' }, { quoted: info });
                return;
             }
        }

        // Cenário 2: Manual (no corpo) OU Overrides sem resposta
        // Só entra aqui se NÃO for uma resposta OU se for uma resposta mas overrides foram passados
        if (!quoted || Object.keys(overrides).length > 0) {
             const linhas = text.split('\n');
             // Verifica se tem MAIS de uma linha (indicando ficha no corpo) E se NÃO HÁ overrides
             if (linhas.length > 1 && Object.keys(overrides).length === 0 && !quoted) {
                 textoFicha = linhas.slice(1).join('\n');
                 autorDaFichaJid = null; // Não há quem remover
             } else if (Object.keys(overrides).length > 0) {
                 // Se tem overrides, tentamos usar o texto da resposta (se houver) como base
                 if(quoted) {
                     textoFicha = parser.extractText(quoted); // Pega texto base
                     if (!autorDaFichaJid) autorDaFichaJid = ctx?.participant; // Tenta pegar de novo
                 } else {
                     textoFicha = ''; // Sem resposta, força depender dos overrides
                     autorDaFichaJid = null;
                 }
             } else if (!quoted) { // Nenhuma das condições anteriores e não é resposta
                 await sock.sendMessage(from, { text: '⚠ Comando inválido. Use respondendo a uma ficha OU digite a ficha abaixo OU use overrides (cla=...).' }, { quoted: info });
                 return;
             }
        }


        // --- Processar a Ficha ---
        await sock.sendMessage(from, { react: { text: '🛠️', key: info.key } });

        // Mesmo que textoFicha esteja vazio, o parser lida com isso
        const dadosParseados = parser.parseFicha(textoFicha);

        // Verifica erro do parser SOMENTE se o campo específico não foi fornecido no override
        if (dadosParseados.error) {
             if (dadosParseados.error.includes('Nome') && !overrides.nome) {
                 await sock.sendMessage(from, { react: { text: '❌', key: info.key } });
                 await sock.sendMessage(from, { text: `❌ Erro ao ler a ficha: ${dadosParseados.error}. Forneça o nome (ex: nome=Fulano).` }, { quoted: info });
                 return;
             }
             console.log("[Registrar] Erro do parser ignorado devido a overrides:", dadosParseados.error);
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

        // --- Salvar no Banco de Dados ---
        db.saveFicha(targetJid, dadosParaSalvar);

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
 * Lógica do comando !andamento (Histórias 2.3 e 2.4 - ATUALIZADO)
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

        if (subComando === 'clas') {
            // --- Lógica História 2.3 (Sem alteração) ---
            const fichas = db.getAllFichas();
            const fichasArray = Object.values(fichas);

            if (fichasArray.length === 0) {
                await sock.sendMessage(from, { text: 'ℹ️ Nenhuma ficha foi processada ainda.' }, { quoted: info });
                return;
            }

            const contagem = {};
            for (const ficha of fichasArray) {
                const cla = ficha.cla || 'Sem Clã';
                contagem[cla] = (contagem[cla] || 0) + 1;
            }

            let resposta = '📊 *Andamento do Recrutamento por Clã*\n\n';
            const clasOrdenados = Object.entries(contagem).sort(([, a], [, b]) => b - a);

            for (const [cla, total] of clasOrdenados) {
                const emoji = fichasArray.find(f => f.cla === cla)?.emojiCla || '❓';
                resposta += `${emoji} *${cla}:* ${total} recrutas\n`;
            }
            resposta += `\n*Total:* ${fichasArray.length} fichas processadas.`;
            await sock.sendMessage(from, { text: resposta }, { quoted: info });

        } else if (subComando === 'players') {
            // --- LÓGICA ATUALIZADA (História 2.4 Reinterpretada) ---
            const fichas = db.getAllFichas();
            const fichasArray = Object.values(fichas);

            if (fichasArray.length === 0) {
                await sock.sendMessage(from, { text: 'ℹ️ Nenhuma ficha foi processada ainda.' }, { quoted: info });
                return;
            }

            // Agora agrupa pelo campo 'recrutadoPorTexto' (o nome semi-limpo do recrutador)
            const contagemPorRecrutador = {};
            for (const ficha of fichasArray) {
                const recrutadorNome = ficha.recrutadoPorTexto || 'Não Informado'; // Usa o campo correto
                contagemPorRecrutador[recrutadorNome] = (contagemPorRecrutador[recrutadorNome] || 0) + 1;
            }

            let resposta = '📈 *Recrutamento por Player*\n_(Quem indicou o recruta)_\n\n';
            const recrutadoresOrdenados = Object.entries(contagemPorRecrutador)
                .sort(([, a], [, b]) => b - a); // Ordena por quem recrutou mais

            for (const [nomeRecrutador, total] of recrutadoresOrdenados) {
                 // Exibe o nome semi-limpo (com emojis) e a contagem
                resposta += `👥 *${nomeRecrutador}:* ${total} recrutas\n`;
            }

            resposta += `\n*Total:* ${fichasArray.length} fichas processadas.`;
            // Não precisa mais de menções aqui
            await sock.sendMessage(from, { text: resposta }, { quoted: info });
            // --- FIM DA LÓGICA ATUALIZADA ---

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

        const fichas = db.getAllFichas();
        let fichasArray = Object.values(fichas); // Usa 'let' para poder reatribuir

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
        // --- FIM DA NOVA LÓGICA ---


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
        const tempDir = path.join(__dirname, '..', '..', 'temp');
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

// --- FUNÇÃO DE MENU ATUALIZADA ---
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
// --- FIM DA FUNÇÃO ATUALIZADA ---

// Exporta o handler principal que o messageRouter vai chamar
module.exports = { handlerRecrutamento };