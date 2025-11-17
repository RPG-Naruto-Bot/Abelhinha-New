// src/commands/recrutamento/parsers.js
const moment = require('moment-timezone');

/**
 * Analisa os argumentos para os comandos !andamento
 * Retorna o período de tempo para a consulta (timestamps e título).
 */
function parseAndamentoArgs(args) {
    const now = moment().tz('America/Sao_Paulo');
    const dayOfWeek = now.isoWeekday(); // 1 (Segunda) a 7 (Domingo)
    let startOfPeriod, endOfPeriod, periodTitle;
    
    // O argumento da data vem em args[1] (pois args[0] é "clas" ou "players")
    const dateRangeArg = args[1]; 

    if (dateRangeArg && dateRangeArg.match(/^\d{2}\/\d{2}\/\d{4}-\d{2}\/\d{2}\/\d{4}$/)) {
        // Cenário 1: Data Específica Fornecida
        const [inicioStr, fimStr] = dateRangeArg.split('-');
        startOfPeriod = moment.tz(inicioStr, "DD/MM/YYYY", "America/Sao_Paulo").startOf('day');
        endOfPeriod = moment.tz(fimStr, "DD/MM/YYYY", "America/Sao_Paulo").endOf('day');

        if (!startOfPeriod.isValid() || !endOfPeriod.isValid() || startOfPeriod.isAfter(endOfPeriod)) {
            throw new Error('Formato de data inválido. Use DD/MM/YYYY-DD/MM/YYYY.');
        }
        periodTitle = `Período (${startOfPeriod.format('DD/MM/YY')} a ${endOfPeriod.format('DD/MM/YY')})`;
    } else {
        // Cenário 2: Lógica da Missão Semanal (Padrão)
        if (dayOfWeek >= 1 && dayOfWeek <= 2) { // Seg-Ter
            startOfPeriod = now.clone().isoWeekday(1).startOf('day');
            endOfPeriod = now.clone().isoWeekday(2).endOf('day');
            periodTitle = `Missão Atual (Seg-Ter)`;
        } else if (dayOfWeek >= 4 && dayOfWeek <= 5) { // Qui-Sex
            startOfPeriod = now.clone().isoWeekday(4).startOf('day');
            endOfPeriod = now.clone().isoWeekday(5).endOf('day');
            periodTitle = `Missão Atual (Qui-Sex)`;
        } else { // Dias de folga (Qua, Sab, Dom), mostra a última missão
            let targetDayStart = (dayOfWeek === 3) ? 1 : 4; // Se Quarta, alvo é Seg(1). Se FDS, alvo é Qui(4).
            let targetDayEnd = (dayOfWeek === 3) ? 2 : 5;   // Se Quarta, alvo é Ter(2). Se FDS, alvo é Sex(5).
            
            startOfPeriod = now.clone().isoWeekday(targetDayStart).startOf('day');
            endOfPeriod = now.clone().isoWeekday(targetDayEnd).endOf('day');
            
            // Se a "última missão" que calculamos ainda está no futuro (ex: é Seg e o alvo é Qui)
            // ou se estamos em um dia de folga, pegamos o período anterior.
            if (now.isBefore(startOfPeriod) || [3, 6, 7].includes(dayOfWeek)) {
                 startOfPeriod.subtract(7, 'days');
                 endOfPeriod.subtract(7, 'days');
            }
            periodTitle = `Última Missão`;
        }
    }
    return { startTimestamp: startOfPeriod.valueOf(), endTimestamp: endOfPeriod.valueOf(), periodTitle };
}

/**
 * Analisa os argumentos para o comando !exportar
 */
function parseExportarArgs(args) {
    const dateRangeArg = args[0]; // Argumento da data é o primeiro (ex: !exportar 10/10/...)
    let startTimestamp = 0; 
    let endTimestamp = Date.now();
    let periodTitle = "Total";
    let periodFile = "Total";

    if (dateRangeArg && dateRangeArg.match(/^\d{2}\/\d{2}\/\d{4}-\d{2}\/\d{2}\/\d{4}$/)) {
        const [inicioStr, fimStr] = dateRangeArg.split('-');
        const dataInicio = moment.tz(inicioStr, "DD/MM/YYYY", "America/Sao_Paulo").startOf('day');
        const dataFim = moment.tz(fimStr, "DD/MM/YYYY", "America/Sao_Paulo").endOf('day');
        
        if (!dataInicio.isValid() || !dataFim.isValid() || dataInicio.isAfter(dataFim)) {
            throw new Error('Formato de data inválido. Use DD/MM/YYYY-DD/MM/YYYY.');
        }
        startTimestamp = dataInicio.valueOf();
        endTimestamp = dataFim.valueOf();
        periodTitle = `(${dataInicio.format("DD/MM/YY")} a ${dataFim.format("DD/MM/YY")})`;
        periodFile = `(${dataInicio.format("DDMMYY")}-${dataFim.format("DDMMYY")})`;
    }
    return { startTimestamp, endTimestamp, periodTitle, periodFile };
}

module.exports = { parseAndamentoArgs, parseExportarArgs };