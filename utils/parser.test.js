// utils/parser.test.js
const { extractText,
  detectarFicha,
  parseFicha,
  normalizeCla,
  tryExtract } = require('./parser'); // Certifique-se que o nome da função está correto

// 1. 🗂️ CRIAMOS A "TABELA" DE CENÁRIOS
const testCases = [
  // --- Cenário 1: O Caminho Feliz (O que já fizemos) ---
  {
    description: 'processar uma ficha completa e correta',
    input: `➖➖➖➖➖➖➖➖➖➖➖
💫🕉'RPG De Naruto Online'🕉💫

💢 Ficha 💢

👉🏻 Nome/Nick: Dante Tarurudbii
👉🏻 Clã:  kyusuke
👉🏻 Recrutado por: Thalita💹✳

➖➖➖➖➖➖➖➖➖➖➖`,
    expected: {
      nome: 'Dante Tarurudbii',
      cla: 'kyusuke',
      recrutadoPorTexto: 'Thalita💹✳',
      emojiCla: '🗯',
      success: true
    }
  },

  // --- Cenário 2: Caminho Triste (Faltando um campo) ---
  {
    description: 'retornar null se o Clã estiver faltando',
    input: `➖➖➖➖➖➖➖➖➖➖➖
💢 Ficha 💢

👉🏻 Nome/Nick: Novo Player
👉🏻 Recrutado por: Alguém

➖➖➖➖➖➖➖➖➖➖➖`,
    expected: { error: 'O campo "Clã" está vazio ou não foi preenchido.' }
  },

  // --- Cenário 3: Caminho Triste (Faltando "Nome") ---
  {
    description: 'retornar null se o Nome estiver faltando',
    input: `➖➖➖➖➖➖➖➖➖➖➖
💢 Ficha 💢

👉🏻 Clã: Uchiha
👉🏻 Recrutado por: Alguém

➖➖➖➖➖➖➖➖➖➖➖`,
    expected: { error: 'Não foi possível identificar o Nome na ficha.' }
  },

  // --- Cenário 4: Caminho Triste (Texto aleatório) ---
  {
    description: 'retornar null se for um texto aleatório',
    input: 'Olá, bom dia! Isso não é uma ficha.',
    expected: { error: 'Não foi possível identificar o Nome na ficha.' }
  },

  // --- Cenário 5: Caso Limite (Bagunçado com espaços) ---
  {
    description: 'processar corretamente mesmo com espaços extras',
    input: `
    
    💢 Ficha 💢

👉🏻 Nome/Nick:    Player Com Espaço   
👉🏻 Clã:  hyuuga  
👉🏻 Recrutado por:   O Próprio   

`,
    expected: { error: 'O campo \"Clã\" está vazio ou não foi preenchido.' }
  },

  // --- Cenário 6: Caso Limite (Input Nulo ou Vazio) ---
  {
    description: 'retornar null para uma string vazia',
    input: '',
    expected: { error: 'Texto da ficha muito curto ou inválido.' }
  },
  {
    description: 'retornar null para um input null',
    input: null,
    expected: { error: 'Texto da ficha muito curto ou inválido.' }
  },
  {
    description: 'processar corretamente a ficha com apenas nome e vez de nome/nick',
    input: `
💢 Ficha 💢
👉🏻 Nome: Sasuke
👉🏻 Clã: Uchiha
👉🏻 Recrutado por: Orochimaru
`,
    expected: {
      nome: 'Sasuke',
      cla: 'uchiha',
      recrutadoPorTexto: 'Orochimaru',
      emojiCla: '㊗',
      success: true
    }
  },
  {
    description: 'processar corretamente a ficha com apenas nick e vez de nome/nick',
    input: `
💢 Ficha 💢
👉🏻 Nick: Sasuke
👉🏻 Clã: Uchiha
👉🏻 Recrutado por: Orochimaru
`,
    expected: {
      nome: 'Sasuke',
      cla: 'uchiha',
      recrutadoPorTexto: 'Orochimaru',
      emojiCla: '㊗',
      success: true
    }
  },
  {
    description: 'processar corretamente um input onde foram removidos os nomes dos campos',
    input: `
💢 Ficha 💢
👉🏻 Sasuke
👉🏻 Uchiha
👉🏻 Orochimaru
`,
    expected: { error: 'Não foi possível identificar o Nome na ficha.' }
  },
  {
    description: 'encontrar o recrutador na linha seguinte à chave',
    input: `
    💢 Ficha 💢
    Nome/Nick: Testador da Próxima Linha
    Clã: Uchiha
    Recrutado por:
    O Próprio Recrutador 🗯
    `,
    // O 'expected' deve estar corrigido para o novo retorno da sua função
    expected: {
      success: true,
      nome: 'Testador da Próxima Linha',
      cla: 'uchiha', // <- Corrigido para minúsculo
      emojiCla: '㊗',
      recrutadoPorTexto: 'O Próprio Recrutador 🗯' // Sua normalizeRecruiterNameLight mantém o emoji
    }
  },
  {
    description: 'definir recrutador como "Não informado" se o campo estiver faltando',
    input: `
    Nome: Teste Sem Recrutador
    Clã: Uchiha
    `,
    expected: {
      success: true,
      nome: 'Teste Sem Recrutador',
      cla: 'uchiha',
      emojiCla: '㊗',
      recrutadoPorTexto: 'Não informado' // <-- O ALVO!
    }
  },
];

// 2. ⚙️ EXECUTAMOS OS TESTES COM O test.each
describe('Testes do parseFicha', () => {

  // O Jest vai rodar esta função UMA VEZ para cada objeto no array 'testCases'
  test.each(testCases)(
    'deve $description', // O nome do teste será preenchido dinamicamente
    ({ input, expected }) => { // Pega o 'input' e o 'expected' de cada cenário

      // 2. Act (Agir)
      const result = parseFicha(input);

      // 3. Assert (Afirmar)
      expect(result).toEqual(expected);
    }
  );

});

describe('Testes do normalizeCla', () => {
  // Vamos criar cenários para todos os clãs
  const claTestCases = [
    { input: 'Pikachu', expected: { claEncontrado: null, emojiCla: ''} }, // Clã inválido de controle
    // --- Clãs Válidos (Konoha) ---
    { input: 'uchiha', expected: { claEncontrado: 'uchiha', emojiCla: '㊗' } },
    { input: 'inuzuka', expected: { claEncontrado: 'inuzuka', emojiCla: '🐾' } },
    { input: 'aburame', expected: { claEncontrado: 'aburame', emojiCla: '🕷' } },
    { input: 'uzumaki', expected: { claEncontrado: 'uzumaki', emojiCla: '🌀' } },
    { input: 'senju', expected: { claEncontrado: 'senju', emojiCla: '♓' } },
    { input: 'nara', expected: { claEncontrado: 'nara', emojiCla: '♣' } },
    { input: 'namikaze', expected: { claEncontrado: 'namikaze', emojiCla: '〽' } },
    { input: 'yamanaka', expected: { claEncontrado: 'yamanaka', emojiCla: '🛐' } },

    // --- Clãs Especiais / Ame ---
    { input: 'kyusuke', expected: { claEncontrado: 'kyusuke', emojiCla: '🗯' } }, // Baseado no seu debug, este não capitaliza
    { input: 'garasu', expected: { claEncontrado: 'garasu', emojiCla: '⚪' } },
    { input: 'pain', expected: { claEncontrado: 'pain', emojiCla: '☦' } },
    { input: 'kagari', expected: { claEncontrado: 'kagari', emojiCla: '📛' } },
    { input: 'kami', expected: { claEncontrado: 'kami', emojiCla: '⚜️' } },

    // --- Clãs (Oto) ---
    { input: 'kunmo', expected: { claEncontrado: 'kunmo', emojiCla: '🕸' } },
    { input: 'shin', expected: { claEncontrado: 'shin', emojiCla: '👁‍🗨' } },
    { input: 'yakushi', expected: { claEncontrado: 'yakushi', emojiCla: '♉' } },
    { input: 'orochi', expected: { claEncontrado: 'orochi', emojiCla: '🔯' } },
    { input: 'jūgo', expected: { claEncontrado: 'jūgo', emojiCla: '⚛' } },

    // --- Clãs (Kiri) ---
    { input: 'hoshigaki', expected: { claEncontrado: 'hoshigaki', emojiCla: '⛎' } },
    { input: 'yuki', expected: { claEncontrado: 'yuki', emojiCla: '❄' } },
    { input: 'karaitachi', expected: { claEncontrado: 'karaitachi', emojiCla: '⚕' } },
    { input: 'hougan', expected: { claEncontrado: 'hougan', emojiCla: '㊙' } },

    // --- Clãs (Suna) ---
    { input: 'soubaki', expected: { claEncontrado: 'soubaki', emojiCla: '🈷' } },
    { input: 'akasuna', expected: { claEncontrado: 'akasuna', emojiCla: '🎭' } },
    { input: 'render', expected: { claEncontrado: 'render', emojiCla: '🈚' } },
    { input: 'hoki', expected: { claEncontrado: 'hoki', emojiCla: '💮' } },
    { input: 'kazekage', expected: { claEncontrado: 'kazekage', emojiCla: '🏺' } },

    // --- Clãs (Iwa/Outros) ---
    { input: 'shouton', expected: { claEncontrado: 'shouton', emojiCla: '💎' } },
    { input: 'bakurei', expected: { claEncontrado: 'bakurei', emojiCla: '🕊' } },
    { input: 'hinsei', expected: { claEncontrado: 'hinsei', emojiCla: '⛓' } },
    { input: 'kamizuru', expected: { claEncontrado: 'kamizuru', emojiCla: '🐝' } },

    // --- Casos de Borda (TRIM e CASE) ---
    { input: '   uchiha   ', expected: { claEncontrado: 'uchiha', emojiCla: '㊗' } }, // Testando .trim()
    { input: 'UcHiHa', expected: { claEncontrado: 'uchiha', emojiCla: '㊗' } }, // Testando case-insensitivity

    // --- Casos de Falha (Baseado nos seus logs) ---
    { input: 'hyuuga', expected: { claEncontrado: null, emojiCla: '' } }, // Log: "SEM MATCH ... Input 'hyuuga' -> ... Emoji ''"
    { input: 'ClaInvalido', expected: { claEncontrado: null, emojiCla: '' } }, // Assumindo que o default é emoji ''
    { input: '', expected: { claEncontrado: null, emojiCla: '' } }, // Log: "SEM MATCH ... Input '' -> ... Emoji ''"
    { input: null, expected: { claEncontrado: null, emojiCla: '' } }, // Testando input nulo
    { input: '㊗', expected: { claEncontrado: 'uchiha', emojiCla: '㊗' } },

    // -- Casos extremos de falha --
    { input: 'Kamizuru🐝', expected: { claEncontrado: 'kamizuru', emojiCla: '🐝' } },
    { input: '⚜️Kami', expected: { claEncontrado: 'kami', emojiCla: '⚜️' } },
    { input: '  🐾Inuzuka  ', expected: { claEncontrado: 'inuzuka', emojiCla: '🐾' } },
    // --- Casos Extremos e Mistos ---
    { input: 'Kamizuru🐝', expected: { claEncontrado: 'kamizuru', emojiCla: '🐝' } },
    { input: '⚜️Kami', expected: { claEncontrado: 'kami', emojiCla: '⚜️' } },
    { input: '  🐾Inuzuka  ', expected: { claEncontrado: 'inuzuka', emojiCla: '🐾' } },
    { input: '🐝Kamizuru🐝', expected: { claEncontrado: 'kamizuru', emojiCla: '🐝' } },
    { input: '🐾Inu🐾zuka', expected: { claEncontrado: 'inuzuka', emojiCla: '🐾' } },
    { input: '**🕷Aburame**', expected: { claEncontrado: 'aburame', emojiCla: '🕷' } },
    { input: '__🌀 Uzumaki__', expected: { claEncontrado: 'uzumaki', emojiCla: '🌀' } },
    { input: '〽️  Namikaze  ', expected: { claEncontrado: 'namikaze', emojiCla: '〽' } },
    { input: '🛐yamanaka🛐', expected: { claEncontrado: 'yamanaka', emojiCla: '🛐' } },
    { input: '♣NARA♣', expected: { claEncontrado: 'nara', emojiCla: '♣' } },
    { input: '🌀  uzumaki💫', expected: { claEncontrado: 'uzumaki', emojiCla: '🌀' } },
    { input: '🐾  🐾  inuzuka', expected: { claEncontrado: 'inuzuka', emojiCla: '🐾' } },
    { input: 'uzumaki\u200B', expected: { claEncontrado: 'uzumaki', emojiCla: '🌀' } },
    { input: '⚜️kami\uFE0F', expected: { claEncontrado: 'kami', emojiCla: '⚜️' } },
    { input: '“Inuzuka”', expected: { claEncontrado: 'inuzuka', emojiCla: '🐾' } },
    { input: '‘Aburame’', expected: { claEncontrado: 'aburame', emojiCla: '🕷' } },
    { input: '🐝Kamizuru💀', expected: { claEncontrado: 'kamizuru', emojiCla: '🐝' } },
    { input: '💫🐝Kamizuru', expected: { claEncontrado: 'kamizuru', emojiCla: '🐝' } },
    { input: '💀', expected: { claEncontrado: null, emojiCla: '' } },
    { input: '   ', expected: { claEncontrado: null, emojiCla: '' } },

  ];

  // Usamos o test.each para rodar todos os cenários
  test.each(claTestCases)(
    'deve normalizar o input "$input" para "$expected.cla" com emoji "$expected.emojiCla"',
    ({ input, expected }) => {

      const result = normalizeCla(input);
      expect(result).toEqual(expected);

    }
  );
});

describe('Testes do detectarFicha', () => {

  const testCases = [
    // --- Casos VERDADEIROS ---
    { desc: 'detectar uma ficha padrão', input: 'Nome: Gui\nClã: Kyusuke', expected: true },
    { desc: 'detectar uma ficha com "nick"', input: 'Nick: Gui\nClan: Uchiha', expected: true },
    { desc: 'detectar uma ficha com "nome/nick"', input: 'Nome/Nick: Gui\nClã: Senju', expected: true },
    { desc: 'ignorar maiúsculas/minúsculas', input: 'NOME: GUI\nCLA: UCHIHA', expected: true },

    // --- Casos FALSOS ---
    { desc: 'ignorar se faltar nome', input: 'Clã: Uchiha', expected: false },
    { desc: 'ignorar se faltar clã', input: 'Nome: Gui', expected: false },
    { desc: 'ignorar texto aleatório', input: '!ping', expected: false },
    { desc: 'ignorar string vazia', input: '', expected: false },
    { desc: 'ignorar input null', input: null, expected: false },
    { desc: 'ignorar mensagens de processamento', input: 'Processando ficha...', expected: false },
  ];

  test.each(testCases)(
    'deve $desc',
    ({ input, expected }) => {
      expect(detectarFicha(input)).toBe(expected);
    }
  );
});

describe('Testes do extractText', () => {

  const testCases = [
    // --- Caminhos Felizes (Tipos de Mensagem) ---
    {
      desc: 'extrair de uma mensagem de texto simples',
      input: { conversation: 'Olá mundo' },
      expected: 'Olá mundo'
    },
    {
      desc: 'extrair de uma mensagem de texto estendida (reply)',
      input: { extendedTextMessage: { text: 'Texto de reply' } },
      expected: 'Texto de reply'
    },
    {
      desc: 'extrair de uma legenda de imagem',
      input: { imageMessage: { caption: 'Legenda da foto' } },
      expected: 'Legenda da foto'
    },
    {
      desc: 'extrair de uma legenda de vídeo',
      input: { videoMessage: { caption: 'Legenda do vídeo' } },
      expected: 'Legenda do vídeo'
    },
    {
      desc: 'extrair de uma mensagem efêmera',
      input: { ephemeralMessage: { message: { conversation: 'Texto efêmero' } } },
      expected: 'Texto efêmero'
    },
    {
      desc: 'extrair de um documento com legenda',
      input: { documentWithCaptionMessage: { message: { documentMessage: { caption: 'Legenda do doc' } } } },
      expected: 'Legenda do doc'
    },
    {
      desc: 'extrair de um convite de grupo',
      input: { groupInviteMessage: { caption: 'Convite' } },
      expected: 'Convite'
    },

    // --- Caminhos Tristes (Inputs Inválidos) ---
    {
      desc: 'retornar string vazia para input null',
      input: null,
      expected: ''
    },
    {
      desc: 'retornar string vazia para input undefined',
      input: undefined,
      expected: ''
    },
    {
      desc: 'retornar string vazia para objeto vazio',
      input: {},
      expected: ''
    },
    {
      desc: 'retornar string vazia para um tipo de msg desconhecido',
      input: { audioMessage: { duration: 123 } }, // Tipo que não está na função
      expected: ''
    },

    // --- Cenário para View Once v2 (Alvo: 22) ---
    {
      desc: 'extrair de uma view-once (v2)',
      input: { viewOnceMessageV2: { message: { conversation: 'Texto v2' } } },
      expected: 'Texto v2'
    },
    // --- Cenário para View Once v1 (Alvo: 28-30) ---
    {
      desc: 'extrair de uma view-once (v1) de imagem',
      input: { viewOnceMessage: { message: { imageMessage: { caption: 'Legenda v1' } } } },
      expected: 'Legenda v1'
    },
    {
      desc: 'extrair de uma view-once (v1) de vídeo',
      input: { viewOnceMessage: { message: { videoMessage: { caption: 'Vídeo v1' } } } },
      expected: 'Vídeo v1'
    },
    // --- Cenário para View Once v1 (Alvo: 28-30) ---
    {
      desc: 'extrair de uma view-once (v1) de imagem',
      input: { viewOnceMessage: { message: { imageMessage: { caption: 'Legenda v1' } } } },
      expected: 'Legenda v1'
    },
    {
      desc: 'extrair de uma view-once (v1) de vídeo',
      input: { viewOnceMessage: { message: { videoMessage: { caption: 'Vídeo v1' } } } },
      expected: 'Vídeo v1'
    },
  ];

  test.each(testCases)(
    'deve $desc',
    ({ input, expected }) => {
      expect(extractText(input)).toBe(expected);
    }
  );
});

describe('Testes do tryExtract', () => {

  const testCases = [
    // --- Alvo: Linha 129 (Caminho com dois-pontos) ---
    {
      desc: 'extrair valor usando dois-pontos',
      input: '👉🏻 Nome: Gui Kyusuke 🗯',
      keywords: ['nome', 'nick'],
      expected: 'Gui Kyusuke 🗯'
    },

    // --- Alvo: Linha 130/131 (Caminho do Fallback Regex) ---
    {
      desc: 'extrair valor sem dois-pontos (fallback regex)',
      input: 'Clã Uchiha',
      keywords: ['clã', 'clan', 'cla'],
      expected: 'Uchiha'
    },

    // --- Alvo: Linha 127 (Falha na Keyword) ---
    {
      desc: 'retornar null se a keyword não for encontrada',
      input: 'Esta é uma linha aleatória.',
      keywords: ['nome', 'nick'], // Procurando 'nome' em 'linha aleatória'
      expected: null // Deve falhar no 'if' da linha 127
    },

    // --- Alvo: Linha 132 (Falha no Regex Fallback) ---
    {
      desc: 'retornar o resto da linha mesmo se não for "significativo"',
      input: 'Recrutado por',
      keywords: ['recrutado', 'indicado'],
      expected: 'por'
    },
    {
      desc: 'retornar null se a linha for SÓ a keyword',
      input: 'Nome', // Tem a keyword, mas não tem valor
      keywords: ['nome', 'nick'],
      expected: null // Deve falhar na regex e cair no "return null" final
    },
  ];

  test.each(testCases)(
    'deve $desc',
    ({ input, keywords, expected }) => {
      expect(tryExtract(input, keywords)).toBe(expected);
    }
  );
});