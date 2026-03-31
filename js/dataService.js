/**
 * dataService.js — Serviço de Dados
 *
 * Responsabilidade única: carregar os 6 JSONs do IBGE de forma assíncrona,
 * armazená-los em memória e expô-los para o resto da aplicação.
 *
 * NÃO manipula DOM. NÃO faz cálculos.
 */

const DATA_PATHS = {
  altura:      './data/altura.json',
  escolaridade:'./data/escolaridade.json',
  estadoCivil: './data/estado_civil.json',
  obesidade:   './data/obesidade.json',
  religiao:    './data/religiao.json',
  renda:       './data/renda.json',
  fumo:        './data/fumo.json',
  alcool:      './data/alcool.json',
  filhos:      './data/filhos.json',
  signos:      './data/signos.json',
};

// Banco em memória — preenchido após loadAllData()
let _db = null;

/**
 * Carrega todos os JSONs em paralelo (Promise.allSettled para máxima resiliência).
 * @returns {Promise<Object>} O banco de dados completo em memória.
 */
export async function loadAllData() {
  if (_db) return _db; // Cache: não faz fetch duplo

  const entries = await Promise.allSettled(
    Object.entries(DATA_PATHS).map(async ([key, path]) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`[dataService] Falha ao carregar "${path}" — HTTP ${response.status}`);
      }
      const json = await response.json();
      return [key, json];
    })
  );

  _db = {};
  const erros = [];

  for (const result of entries) {
    if (result.status === 'fulfilled') {
      const [key, data] = result.value;
      _db[key] = data;
    } else {
      erros.push(result.reason?.message ?? String(result.reason));
      console.error(result.reason);
    }
  }

  if (erros.length > 0) {
    console.warn(`[dataService] ${erros.length} fonte(s) falharam:`, erros);
  }

  return _db;
}

/**
 * Retorna o banco em memória (deve ser chamado após loadAllData resolver).
 * @returns {Object|null}
 */
export function getDB() {
  return _db;
}
