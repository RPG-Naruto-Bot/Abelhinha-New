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

function normalizeCla(claInput) {
    const emojiRegex =
  /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F)?(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F)?)*/gu;
   
    const cleanAndStripVS = (s) =>
        cleanValue(s).replace(/\0|\u200B|\uFE0F/g, '').trim();

    const inputLimpo = cleanAndStripVS(claInput)
        .replace(/[‘’‚‛“”„‟«»‹›"'`´]/g, '')
        .trim();

    let claEncontrado = null;
    let emojiCla = '';

    // 1. Captura emoji
    const emojiMatch = inputLimpo.match(emojiRegex);
    if (emojiMatch) emojiCla = emojiMatch[0];

    // 2. Remove o emoji do nome
    const nomeSemEmoji = inputLimpo.replace(emojiRegex, '').trim();
    const nomeNorm = norm(nomeSemEmoji);

    // 3. Se achou emoji, tenta casar
    if (emojiCla) {
        for (const [nomeClaOficial, emoji] of Object.entries(clasAceitos)) {
            if (
                emoji &&
                norm(emoji.replace(/\uFE0F/g, '')) === norm(emojiCla.replace(/\uFE0F/g, ''))
            ) {
                claEncontrado = nomeNorm || nomeClaOficial;
                emojiCla = emoji; // mantém FE0F original
                break;
            }
        }
    }

    // 4. Tenta casar pelo nome
    if (!claEncontrado && nomeNorm) {
        for (const [nomeClaOficial, emoji] of Object.entries(clasAceitos)) {
            if (nomeNorm === norm(nomeClaOficial)) {
                claEncontrado = nomeClaOficial;
                emojiCla = emoji;
                break;
            }
        }
    }
    if (!claEncontrado) {
        claEncontrado = null;
        emojiCla = '';
    }

    // 5. Se não achou nada, retorna nulos
    return { claEncontrado, emojiCla };
}

/**
 * Detecta se um texto parece ser uma ficha.
 */
function detectarFicha(texto) {
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
    const dashy = /[-—_➖=]{3,}/.test(t);
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
    const ln = norm(raw);
    if (!keywords.some(k => ln.includes(k))) return null;
    const after = raw.split(/[:\-–—]\s*/);
    if (after.length > 1) return after.slice(1).join(':').trim();
    const match = raw.match(new RegExp(`^[^:]?(?:${keywords.join('|')})(?=\\s|$)\\s+(.*)$`, 'i'));
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
            const v = tryExtract(linhaRaw, ['clã', 'cla', 'clan']);
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
            }
        }
    } // --- Fim do Loop Principal ---

    // 1. Validação do Nome (como você já tinha)
    if (!nome) {
        return { error: 'Não foi possível identificar o Nome na ficha.' };
    }

    // 2. Normaliza o Clã (como você já tinha)
    // 'claInput' é o texto que o parser encontrou (ex: "Akasuna", "Uchiha", "Pikachu", ou "")
    const { claEncontrado, emojiCla } = normalizeCla(claInput);

    // 3. A NOVA TRAVA DE SEGURANÇA
    if (!claEncontrado || claEncontrado === 'Sem Clã') {
        // Falha se o campo "Clã:" estava vazio ou não foi encontrado
        return { error: 'O campo "Clã" está vazio ou não foi preenchido.' };
    }
    // 4. Trava de Validação (O PONTO CRÍTICO CORRIGIDO)
    // Verifica se o clã encontrado EXISTE no seu 'clas.json'
    const claKey = claEncontrado.toLowerCase();

    // Usamos 'clasAceitos' (que é o seu 'clas.json' importado)
    // E verificamos se ele 'tem a propriedade' da claKey.
    if (!Object.prototype.hasOwnProperty.call(clasAceitos, claKey)) {
        // Se o clã (ex: "raiunko") não for encontrado no mapa, é inválido.
        return { error: `O clã "${claEncontrado}" não é um clã válido ou reconhecido.` };
    }

    // 5. Retorna o objeto final (agora 100% validado)
    return {
        success: true,
        nome: nome,
        cla: claEncontrado, // Agora temos certeza que é um clã válido
        emojiCla: emojiCla,
        recrutadoPorTexto: recrutadoPor || 'Não informado'
    };
}

module.exports = {
    extractText,
    detectarFicha,
    parseFicha,
    normalizeCla,
    normalizeRecruiterNameLight,
    tryExtract
};