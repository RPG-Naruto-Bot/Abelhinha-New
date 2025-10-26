/*
 * ARQUIVO: utils/parser.js
 * * Responsabilidade: Conter toda a lógica de extração de texto
 * de mensagens do WhatsApp e de parsing de fichas.
 *
 * ATUALIZADO:
 * 1. Limpeza do 'recrutadoPor' agora é LEVE: remove apenas texto de patente
 * e formatação, MANTENDO os emojis de clã e patente.
 * 2. Nova função 'normalizeCla' para mapear nomes de clã para emojis.
 * 3. Atualização da lógica de parsing para usar a nova função de normalização de clã.
*/

// Carrega os dicionários
const clasAceitos = require('../src/configs/clas.json');
const patentesTexto = require('../src/configs/patentes.json');
const patentesEmojis = require('../src/configs/patentes_emojis.json');
const clanEmojis = Object.values(clasAceitos);
const allKnownEmojis = [...clanEmojis, ...patentesEmojis];
/**
 * Extrai o texto de qualquer tipo de mensagem do WhatsApp.
 */
function extractText(msg) {
    // ... (código do extractText - sem alteração) ...
    if (!msg) return '';
    const unwrap = (m) => (m?.ephemeralMessage?.message) || (m?.viewOnceMessageV2?.message) || m;
    let m = unwrap(msg);
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.viewOnceMessage?.message?.imageMessage?.caption) return m.viewOnceMessage.message.imageMessage.caption || '';
    if (m.viewOnceMessage?.message?.videoMessage?.caption) return m.viewOnceMessage.message.videoMessage.caption || '';
    if (m.documentWithCaptionMessage?.message?.documentMessage?.caption) return m.documentWithCaptionMessage.message.documentMessage.caption || '';
    if (m.groupInviteMessage?.caption) return m.groupInviteMessage.caption;
    try {
        return m?.conversation || '';
    } catch { return ''; }
};

// --- FUNÇÃO DE NORMALIZAÇÃO DE CLÃ (MAIS ROBUSTA AINDA) ---
/**
 * Normaliza o nome OU emoji do clã e encontra o nome oficial e emoji.
 * @param {string} claInput O nome ou emoji do clã vindo da ficha/override.
 * @returns {{claEncontrado: string, emojiCla: string}} Objeto com nome oficial e emoji.
 */
function normalizeCla(claInput) {

    // --- MUDANÇA: Limpeza AINDA MAIS AGRESSIVA ---
    // Remove markdown, aspas, null, ZWS, E o Variation Selector 16 (FE0F)
    const cleanAndStripVS = (s) => cleanValue(s).replace(/\0|\u200B|\uFE0F/g, ''); // Adicionado \uFE0F
    const inputLimpo = cleanAndStripVS(claInput);
    // --- FIM DA MUDANÇA ---

    let claEncontrado = inputLimpo; // Padrão
    let emojiCla = '';
    const claNormInput = norm(inputLimpo); // Normaliza (NFD, lowercase) o input JÁ LIMPO E STRIPPADO

    // 1. Tenta encontrar pelo Emoji PRIMEIRO (comparando normalizados e limpos)
    for (const [nomeClaOficial, emoji] of Object.entries(clasAceitos)) {
        // Limpa e normaliza o emoji do JSON também para garantir
        const emojiLimpo = cleanAndStripVS(emoji || '');
        const emojiNormLimpo = norm(emojiLimpo);

        // -- DEBUG DETALHADO DA COMPARAÇÃO --
        // console.log(`[normalizeCla DEBUG] Comparando InputNorm ('${claNormInput}') com EmojiNorm ('${emojiNormLimpo}') para ${nomeClaOficial}`);

        if (emoji && claNormInput === emojiNormLimpo) {
            claEncontrado = nomeClaOficial;
            emojiCla = emoji; // Guarda o emoji ORIGINAL do JSON
            return { claEncontrado, emojiCla };
        }
    }

    // 2. Se não achou pelo emoji, tenta encontrar pelo Nome
    for (const [nomeClaOficial, emoji] of Object.entries(clasAceitos)) {
        // Compara nome oficial (idealmente já normalizado no JSON) com input normalizado+limpo
        if (claNormInput.includes(nomeClaOficial)) {
            claEncontrado = nomeClaOficial;
            emojiCla = emoji;
            break;
        }
    }

    // Se chegou aqui, não houve match por emoji nem por nome
    if (claEncontrado === inputLimpo) { // Verifica se claEncontrado ainda é o input original
       console.log(`[normalizeCla DEBUG] SEM MATCH DEFINITIVO. Input '${claInput}' -> Retornando Cla '${claEncontrado}', Emoji '${emojiCla}'`);
    }
    return { claEncontrado, emojiCla };
}
// --- FIM DA FUNÇÃO CORRIGIDA ---

/**
 * Detecta se um texto parece ser uma ficha.
 */
function detectarFicha(texto) {
    // ... (código do detectarFicha - sem alteração) ...
    if (!texto) return false;
    const norm = (texto + '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const hasNome = norm.includes('nome:') || norm.includes('nick:') || norm.includes('nome/nick:');
    const hasCla = norm.includes('cla:') || norm.includes('clan:');
    if (norm.includes('processando ficha') || norm.includes('ficha processada com sucesso') || norm.includes('voce sera removido')) {
        return false;
    }
    return hasNome && hasCla;
}

// --- Funções Auxiliares de Parsing ---
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isSeparator = (s) => {
    // ... (código do isSeparator - sem alteração) ...
    const t = (s || '').trim();
    if (!t) return true;
    const noLetters = t.replace(/[A-Za-z0-9Á-Úá-úÀ-Ùà-ù]/g, '').length >= Math.max(3, t.length - 2);
    const dashy = /[\-—_➖=]{3,}/.test(t);
    return dashy || noLetters;
};
const stripMd = (s) => String(s || '').replace(/^[_*~\s]+|[_*~\s]+$/g, '').trim();
const cleanValue = (s) => stripMd(String(s || '').replace(/[“”"']/g, ''));
const isMeaningful = (s) => {
    // ... (código do isMeaningful - sem alteração) ...
    const c = cleanValue(s);
    if (!c || c === '*') return false;
    return /[A-Za-zÁ-Úá-úÀ-Ùà-ù]/.test(c);
};
const tryExtract = (raw, keywords) => {
    // ... (código do tryExtract - sem alteração) ...
    const ln = norm(raw);
    if (!keywords.some(k => ln.includes(k))) return null;
    const after = raw.split(/[:\-–—]\s*/);
    if (after.length > 1) return after.slice(1).join(':').trim();
    const match = raw.match(new RegExp(`^[^:]?\\b(?:${keywords.join('|')})\\b\\s(.*)$`, 'i'));
    if (match && match[1]) return match[1].trim();
    return null;
};
// --- Fim das Funções Auxiliares ---

// --- FUNÇÃO DE LIMPEZA LEVE ATUALIZADA ---
/**
 * Remove APENAS texto de patente e formatação (colchetes, etc.). Mantém emojis.
 * @param {string} name O nome sujo (ex: "Gui Kyusuke 🗯 [Jounin] 🀄")
 * @returns {string} O nome semi-limpo (ex: "Gui Kyusuke 🗯 🀄")
 */
function normalizeRecruiterNameLight(name) {
    if (!name) return '';

    let cleanName = cleanValue(name); // Limpeza básica (markdown, aspas)

    // 1. Remove texto de patentes (lendo do patentes.json)
    const patenteTextRegex = new RegExp(`\\b(${patentesTexto.join('|')})\\b`, 'gi');
    cleanName = cleanName.replace(patenteTextRegex, '');

    // 2. Remove qualquer coisa entre colchetes, parênteses ou chaves
    cleanName = cleanName.replace(/\[.*?\]/g, '');
    cleanName = cleanName.replace(/\(.*\)/g, '');
    cleanName = cleanName.replace(/\{.*?\}/g, '');

    // 3. Limpeza final: remove espaços duplos e espaços no início/fim
    cleanName = cleanName.trim().replace(/\s+/g, ' ');

    return cleanName;
}
// --- FIM DA FUNÇÃO ATUALIZADA ---


/**
 * Processa o texto de uma ficha e extrai os dados estruturados.
 * Organizado para clareza.
 */
function parseFicha(texto) {
    // Validação inicial
    if (!texto || texto.trim().length < 6) {
        return { error: 'Texto da ficha muito curto ou inválido.' };
    }

    let nome = '', claInput = '', recrutadoPor = '';
    const linhas = (texto || '').split('\n');

    // --- Loop Principal de Extração ---
    for (let i = 0; i < linhas.length; i++) {
        const linhaRaw = (linhas[i] || '').trim();

        // Pula linhas vazias ou separadores
        if (!linhaRaw || isSeparator(linhaRaw)) continue;

        // Tenta extrair NOME, se ainda não encontrado
        if (!nome) {
            const v = tryExtract(linhaRaw, ['nome', 'nick', 'nome/nick']);
            if (v && isMeaningful(v)) {
                nome = cleanValue(v);
                continue; // Vai para a próxima linha
            }
        }

        // Tenta extrair CLÃ, se ainda não encontrado
        // (Guarda o input bruto, mesmo que vazio, se a keyword for encontrada)
        if (claInput === '') { // Usamos '' como estado inicial não encontrado
            const v = tryExtract(linhaRaw, ['cla', 'clan']);
            if (v !== null) { // tryExtract retorna null se keyword não encontrada
                claInput = v; // Guarda o valor (pode ser vazio)
                continue; // Vai para a próxima linha
            }
        }

        // Tenta extrair RECRUTADO POR, se ainda não encontrado
        if (!recrutadoPor) {
            let v = tryExtract(linhaRaw, ['recrut', 'indicado', 'recrutador']);
            if (v && isMeaningful(v)) {
                recrutadoPor = normalizeRecruiterNameLight(v); // Limpeza leve
                continue; // Vai para a próxima linha
            }
            // Lógica para valor na próxima linha
            const keyLine = norm(linhaRaw);
            if (['recrut', 'indicado', 'recrutador'].some(k => keyLine.includes(k))) {
                for (let j = i + 1; j < Math.min(i + 6, linhas.length); j++) {
                    const next = (linhas[j] || '').trim();
                    if (!next || isSeparator(next)) continue;
                    const cand = cleanValue(next);
                    if (isMeaningful(cand)) {
                        recrutadoPor = normalizeRecruiterNameLight(cand); // Limpeza leve
                        break; // Sai do loop interno
                    }
                }
                // Mesmo que tenha encontrado na próxima linha, vai para a próxima linha do loop principal
                // (Se 'recrutadoPor' foi encontrado, o 'if (!recrutadoPor)' falhará nas próximas iterações)
            }
        }
    } // --- Fim do Loop Principal ---

    // --- Fallbacks (Se o loop não encontrou) ---
    if (!nome) {
        const m = (texto || '').match(/(?:nome\s*\/\s*nick|nome|nick)[^\n:\-–—][:\-–—]?\s(.+)/i);
        if (m) nome = cleanValue(m[1]);
    }
    if (claInput === '') { // Se loop não achou a keyword 'Clã:'
        const m = norm(texto || '').match(/cl[ãa]n?[^\n:\-–—][:\-–—]?\s([^\n]*)/i);
        if (m) claInput = cleanValue(m[1]); // Pode ser ""
    }
    if (!recrutadoPor) {
        const m = (texto || '').match(/(?:recrutado por|indicado por|recrutador)[^\n:\-–—][:\-–—]?\s(.+)/i);
        if (m) {
            const cand = cleanValue(m[1]);
            if (isMeaningful(cand)) {
                recrutadoPor = normalizeRecruiterNameLight(cand); // Limpeza leve
            }
        }
    }
    // --- Fim dos Fallbacks ---

    // Validação Final: Nome é obrigatório
    if (!nome) {
        return { error: 'Não foi possível identificar o Nome na ficha.' };
    }

    // Normaliza o Clã (mesmo que 'claInput' seja vazio)
    const { claEncontrado, emojiCla } = normalizeCla(claInput);

    // Retorna o objeto final
    return {
        success: true,
        nome: nome,
        cla: claEncontrado, // Pode ser vazio se input era vazio e não deu match
        emojiCla: emojiCla, // Será vazio se claEncontrado for vazio
        recrutadoPorTexto: recrutadoPor || 'Não informado' // Retorna o nome semi-limpo
    };
}

module.exports = {
    extractText,
    detectarFicha,
    parseFicha,
    normalizeCla,
    normalizeRecruiterNameLight
};