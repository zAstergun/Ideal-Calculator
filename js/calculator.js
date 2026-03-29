/**
 * calculator.js — O Cérebro Matemático
 *
 * Contém APENAS funções puras (entrada → saída determinística).
 * Nunca toca no DOM. Nunca importa de main.js.
 *
 * FUNIL DE PROBABILIDADES (multiplicação de eventos independentes):
 *   P_final = P_estadoCivil × P_escolaridade × P_religiao ×
 *             P_renda × P_obesidade × P_altura
 *
 * ══════════════════════════════════════════════════════════════════
 *  ESTRUTURAS DOS JSONs (referência)
 * ══════════════════════════════════════════════════════════════════
 *
 *  altura.json:
 *    { "Estado": { "Masculino|Feminino": { "faixa": mediana_cm } } }
 *    Faixas: "18 anos","19 anos","20 a 24 anos","25 a 29 anos","30 a 34 anos",
 *            "35 a 44 anos","45 a 54 anos","55 a 64 anos","65 a 74 anos","75 anos ou mais"
 *
 *  estado_civil.json:
 *    { "Geral": { "Estado": { "Masculino|Feminino": { "faixa": { "Solteiro": n, "Casado": n, "Divorciado": n } } } } }
 *    Faixas: "18 e 19 anos","20 a 24 anos","25 a 29 anos","30 a 34 anos","35 a 39 anos",
 *            "40 a 44 anos","45 a 49 anos","50 a 54 anos","55 a 59 anos","60 a 64 anos",
 *            "65 a 69 anos","70 a 74 anos","75 a 79 anos","80 anos ou mais"
 *
 *  escolaridade.json:
 *    { "Estado": { "Masculino|Feminino": { "Raça": { "faixa": { "Medio_Completo": n, "Superior_Completo": n } } } } }
 *    Raças: "Branca","Preta","Amarela","Parda","Indígena"
 *    Faixas: "18 a 19 anos","20 a 24 anos","25 a 29 anos","30 a 34 anos","35 a 39 anos",
 *            "40 a 44 anos","45 a 49 anos","50 a 54 anos","55 a 59 anos","60 a 64 anos",
 *            "65 a 69 anos","70 a 74 anos","75 a 79 anos","80 anos ou mais"
 *
 *  religiao.json:
 *    { "Estado": { "Masculino|Feminino": { "faixa": { "Catolica": n, "Evangelica": n,
 *      "Espirita": n, "Matriz_Africana": n, "Sem_Religiao": n } } } }
 *    Faixas: "15 a 19 anos","20 a 24 anos","25 a 29 anos","30 a 39 anos","40 a 49 anos",
 *            "50 a 59 anos","60 a 69 anos","70 a 79 anos","80 anos ou mais"
 *
 *  renda.json:
 *    { "Estado": { "P5": r, "P10": r, ..., "P99": r } }  (percentis de renda em R$, sem gênero)
 *
 *  obesidade.json:
 *    { "Por_Estado": { "Estado": { "Masculino": rate%, "Feminino": rate% } },
 *      "Por_Idade": { "faixa": { "Masculino": rate%, "Feminino": rate% } } }
 */

// ══════════════════════════════════════════════════════════════════
//  CONSTANTES
// ══════════════════════════════════════════════════════════════════

/** Desvio padrão da altura (cm) por gênero, baseado em literatura epidemiológica */
const SIGMA_ALTURA = { Masculino: 7, Feminino: 6 };

/** Todas as raças disponíveis no escolaridade.json */
const TODAS_RACAS = ['Branca', 'Preta', 'Amarela', 'Parda', 'Indígena'];

/** Conversão de código UF para nome completo (chave dos JSONs) */
export const UF_TO_NOME = {
  AC: 'Acre',              AL: 'Alagoas',          AP: 'Amapá',
  AM: 'Amazonas',          BA: 'Bahia',             CE: 'Ceará',
  DF: 'Distrito Federal',  ES: 'Espírito Santo',    GO: 'Goiás',
  MA: 'Maranhão',          MT: 'Mato Grosso',       MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',      PA: 'Pará',              PB: 'Paraíba',
  PR: 'Paraná',            PE: 'Pernambuco',        PI: 'Piauí',
  RJ: 'Rio de Janeiro',    RN: 'Rio Grande do Norte',RS: 'Rio Grande do Sul',
  RO: 'Rondônia',          RR: 'Roraima',           SC: 'Santa Catarina',
  SP: 'São Paulo',         SE: 'Sergipe',           TO: 'Tocantins',
};

// Percentis da renda (chaves do renda.json) com valor aproximado de cada fronteira
// O array é ordenado de P5 a P99 para interpolação CDF
const RENDA_PERCENTIS = ['P5','P10','P20','P30','P40','P50','P60','P70','P80','P90','P95','P99'];
const RENDA_PROB      = [0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 0.99];

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES MATEMÁTICAS
// ══════════════════════════════════════════════════════════════════

/**
 * Aproximação da função de erro (Abramowitz & Stegun §7.1.26)
 * Precisão: |erro| < 1.5×10⁻⁷
 */
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const poly = t * (0.254829592
    + t * (-0.284496736
    + t * (1.421413741
    + t * (-1.453152027
    + t *  1.061405429))));
  return sign * (1 - poly * Math.exp(-a * a));
}

/**
 * CDF da distribuição Normal: P(X ≤ x) para X ~ N(mean, sigma²)
 */
function normalCDF(x, mean, sigma) {
  return 0.5 * (1 + erf((x - mean) / (sigma * Math.SQRT2)));
}

/**
 * Clamp seguro: garante que probabilidades fiquem em [0.001, 1]
 * (nunca retorna exatamente 0 para evitar aniquilação do funil)
 */
function clamp(p) {
  return Math.max(0.001, Math.min(1, p));
}

/**
 * Acessa um caminho de objeto de forma segura.
 * Ex: safeGet(obj, 'a', 'b', 'c') → obj?.a?.b?.c ?? undefined
 */
function safeGet(obj, ...keys) {
  return keys.reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

// ══════════════════════════════════════════════════════════════════
//  MAPEADORES DE FAIXA ETÁRIA
//  Cada JSON usa agrupamentos diferentes; as funções abaixo
//  retornam quais chaves do JSON pertencem ao intervalo [idMin, idMax].
// ══════════════════════════════════════════════════════════════════

/**
 * Faixas do estado_civil.json
 * "18 e 19 anos" | "20 a 24 anos" | "25 a 29 anos" | "30 a 34 anos" |
 * "35 a 39 anos" | "40 a 44 anos" | "45 a 49 anos" | "50 a 54 anos" |
 * "55 a 59 anos" | "60 a 64 anos" | "65 a 69 anos" | "70 a 74 anos" |
 * "75 a 79 anos" | "80 anos ou mais"
 */
const FAIXAS_CIVIL = [
  { key: '18 e 19 anos',   min: 18, max: 19  },
  { key: '20 a 24 anos',   min: 20, max: 24  },
  { key: '25 a 29 anos',   min: 25, max: 29  },
  { key: '30 a 34 anos',   min: 30, max: 34  },
  { key: '35 a 39 anos',   min: 35, max: 39  },
  { key: '40 a 44 anos',   min: 40, max: 44  },
  { key: '45 a 49 anos',   min: 45, max: 49  },
  { key: '50 a 54 anos',   min: 50, max: 54  },
  { key: '55 a 59 anos',   min: 55, max: 59  },
  { key: '60 a 64 anos',   min: 60, max: 64  },
  { key: '65 a 69 anos',   min: 65, max: 69  },
  { key: '70 a 74 anos',   min: 70, max: 74  },
  { key: '75 a 79 anos',   min: 75, max: 79  },
  { key: '80 anos ou mais',min: 80, max: 120 },
];

/**
 * Faixas do escolaridade.json
 * "18 a 19 anos" | "20 a 24 anos" | ... | "80 anos ou mais"
 */
const FAIXAS_ESC = [
  { key: '18 a 19 anos',   min: 18, max: 19  },
  { key: '20 a 24 anos',   min: 20, max: 24  },
  { key: '25 a 29 anos',   min: 25, max: 29  },
  { key: '30 a 34 anos',   min: 30, max: 34  },
  { key: '35 a 39 anos',   min: 35, max: 39  },
  { key: '40 a 44 anos',   min: 40, max: 44  },
  { key: '45 a 49 anos',   min: 45, max: 49  },
  { key: '50 a 54 anos',   min: 50, max: 54  },
  { key: '55 a 59 anos',   min: 55, max: 59  },
  { key: '60 a 64 anos',   min: 60, max: 64  },
  { key: '65 a 69 anos',   min: 65, max: 69  },
  { key: '70 a 74 anos',   min: 70, max: 74  },
  { key: '75 a 79 anos',   min: 75, max: 79  },
  { key: '80 anos ou mais',min: 80, max: 120 },
];

/**
 * Faixas do religiao.json
 * "15 a 19 anos" | "20 a 24 anos" | "25 a 29 anos" | "30 a 39 anos" |
 * "40 a 49 anos" | "50 a 59 anos" | "60 a 69 anos" | "70 a 79 anos" |
 * "80 anos ou mais"
 * Nota: começa em 15; mapeamos 18+ = usa "15 a 19 anos" com ajuste de peso.
 */
const FAIXAS_REL = [
  { key: '15 a 19 anos',   min: 18, max: 19  }, // limita a 18+
  { key: '20 a 24 anos',   min: 20, max: 24  },
  { key: '25 a 29 anos',   min: 25, max: 29  },
  { key: '30 a 39 anos',   min: 30, max: 39  },
  { key: '40 a 49 anos',   min: 40, max: 49  },
  { key: '50 a 59 anos',   min: 50, max: 59  },
  { key: '60 a 69 anos',   min: 60, max: 69  },
  { key: '70 a 79 anos',   min: 70, max: 79  },
  { key: '80 anos ou mais',min: 80, max: 120 },
];

/**
 * Faixas do altura.json
 * "18 anos" | "19 anos" | "20 a 24 anos" | ... | "75 anos ou mais"
 */
const FAIXAS_ALT = [
  { key: '18 anos',         min: 18, max: 18  },
  { key: '19 anos',         min: 19, max: 19  },
  { key: '20 a 24 anos',    min: 20, max: 24  },
  { key: '25 a 29 anos',    min: 25, max: 29  },
  { key: '30 a 34 anos',    min: 30, max: 34  },
  { key: '35 a 44 anos',    min: 35, max: 44  },
  { key: '45 a 54 anos',    min: 45, max: 54  },
  { key: '55 a 64 anos',    min: 55, max: 64  },
  { key: '65 a 74 anos',    min: 65, max: 74  },
  { key: '75 anos ou mais', min: 75, max: 120 },
];

/**
 * Retorna a lista de faixas que se sobrepõem ao intervalo [idMin, idMax],
 * junto com o peso (número de anos de sobreposição) para média ponderada.
 */
function faixasNoIntervalo(tabela, idMin, idMax) {
  return tabela
    .filter(f => f.max >= idMin && f.min <= idMax)
    .map(f => ({
      key: f.key,
      peso: Math.min(f.max, idMax) - Math.max(f.min, idMin) + 1,
    }));
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 1a — FAIXA ETÁRIA (BASE POPULACIONAL)
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula a proporção da população de [18, 120] anos que está dentro do 
 * intervalo selecionado [idMin, idMax]. Também retorna os valores absolutos.
 */
function calcularFiltroIdade(db, estado, genero, idMin, idMax) {
  const base = safeGet(db, 'estadoCivil', 'Geral', estado, genero);
  if (!base) return { proporcao: 1, popTotalAdultos: 1, popSelecionada: 1 };

  // Calculamos a população total de adultos (18+)
  const faixasTodas = faixasNoIntervalo(FAIXAS_CIVIL, 18, 120);
  let popTotalAdultos = 0;
  
  for (const { key, peso } of faixasTodas) {
    const faixaObj = base[key];
    if (!faixaObj) continue;
    const popFaixa = Object.values(faixaObj).reduce((s, v) => s + v, 0);
    const f = FAIXAS_CIVIL.find(x => x.key === key);
    const espacoOriginal = f.max - f.min + 1;
    popTotalAdultos += popFaixa * (peso / espacoOriginal);
  }

  // Calculamos a população apenas dentro de [idMin, idMax]
  const faixasSelect = faixasNoIntervalo(FAIXAS_CIVIL, idMin, idMax);
  let popSelecionada = 0;

  for (const { key, peso } of faixasSelect) {
    const faixaObj = base[key];
    if (!faixaObj) continue;
    const popFaixa = Object.values(faixaObj).reduce((s, v) => s + v, 0);
    const f = FAIXAS_CIVIL.find(x => x.key === key);
    const espacoOriginal = f.max - f.min + 1;
    popSelecionada += popFaixa * (peso / espacoOriginal);
  }

  const proporcao = popTotalAdultos === 0 ? 0.01 : clamp(popSelecionada / popTotalAdultos);
  return { proporcao, popTotalAdultos, popSelecionada };
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 1b — ESTADO CIVIL
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula a proporção da população que possui os estados civis desejados.
 *
 * Algoritmo:
 *   Para cada faixa etária que intersecta [idMin, idMax]:
 *     numerador   += soma dos status desejados (ex: Solteiro + Divorciado)
 *     denominador += soma de todos os status (Solteiro + Casado + Divorciado)
 *   Retorna numerador / denominador (ponderado pelo peso da faixa).
 *
 * @param {Object} db       banco completo
 * @param {string} estado   nome completo do estado (ex: "São Paulo")
 * @param {string} genero   "Masculino" | "Feminino"
 * @param {number} idMin    idade mínima
 * @param {number} idMax    idade máxima
 * @param {string[]} statuses ex: ["Solteiro","Divorciado"]
 * @returns {number} proporção em [0,1]
 */
function calcularFiltroEstadoCivil(db, estado, genero, idMin, idMax, statuses) {
  const base = safeGet(db, 'estadoCivil', 'Geral', estado, genero);
  if (!base) {
    console.warn(`[calculator] estadoCivil: dados não encontrados para ${estado}/${genero}`);
    return 1; // neutro
  }

  const faixas = faixasNoIntervalo(FAIXAS_CIVIL, idMin, idMax);
  let numTotal = 0;
  let numSelecionado = 0;
  let pesoTotal = 0;

  for (const { key, peso } of faixas) {
    const faixa = base[key];
    if (!faixa) continue;

    const totalFaixa = Object.values(faixa).reduce((s, v) => s + v, 0);
    const selecionadoFaixa = statuses.reduce((s, st) => s + (faixa[st] ?? 0), 0);

    numTotal       += totalFaixa     * peso;
    numSelecionado += selecionadoFaixa * peso;
    pesoTotal      += peso;
  }

  if (numTotal === 0 || pesoTotal === 0) return 1;
  return clamp(numSelecionado / numTotal);
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 2 — ESCOLARIDADE
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula a proporção que possui a escolaridade mínima desejada,
 * restringindo ao conjunto de raças selecionadas.
 *
 * Se `racasSel` for vazio, considera todas as raças (comportamento original).
 *
 * @param {Object}   db
 * @param {string}   estado
 * @param {string}   genero
 * @param {number}   idMin
 * @param {number}   idMax
 * @param {string[]} niveis    ex: ["medio","superior"]
 * @param {string[]} racasSel  ex: ["Branca","Parda"] — vazio = todas
 * @returns {number} proporção em [0,1]
 */
function calcularFiltroEscolaridade(db, estado, genero, idMin, idMax, niveis, racasSel = []) {
  const base = safeGet(db, 'escolaridade', estado, genero);
  if (!base) {
    console.warn(`[calculator] escolaridade: dados não encontrados para ${estado}/${genero}`);
    return 1;
  }

  const CHAVE_MAP = {
    medio:    'Medio_Completo',
    superior: 'Superior_Completo',
  };
  const chavesSelecionadas = niveis.map(n => CHAVE_MAP[n]).filter(Boolean);
  if (chavesSelecionadas.length === 0) return 1;

  // Usa raças filtradas (ou todas se vazio)
  const racas = racasSel.length > 0 ? racasSel : TODAS_RACAS;
  const faixas = faixasNoIntervalo(FAIXAS_ESC, idMin, idMax);

  let numTotal = 0;
  let numSelecionado = 0;

  for (const { key, peso } of faixas) {
    for (const raca of racas) {
      const faixa = safeGet(base, raca, key);
      if (!faixa) continue;

      const totalCelula = Object.values(faixa).reduce((s, v) => s + v, 0);
      const selecionadoCelula = chavesSelecionadas.reduce(
        (s, ch) => s + (faixa[ch] ?? 0), 0
      );

      numTotal       += totalCelula     * peso;
      numSelecionado += selecionadoCelula * peso;
    }
  }

  if (numTotal === 0) return 1;
  return clamp(numSelecionado / numTotal);
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 2b — RAÇA / COR
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula a proporção da população que pertence às raças selecionadas.
 *
 * Fonte de dados: escolaridade.json (contém contagens por raça, gênero e faixa).
 * Soma os totais das raças selecionadas e divide pelo total de todas as raças
 * para o mesmo estado/gênero/faixa etária.
 *
 * Se nenhuma raça for selecionada, retorna 1 (neutro — considera todas).
 *
 * @param {Object}   db
 * @param {string}   estado
 * @param {string}   genero
 * @param {number}   idMin
 * @param {number}   idMax
 * @param {string[]} racasSel   ex: ["Branca","Parda"] — vazio = neutro
 * @returns {number} proporção em [0,1]
 */
function calcularFiltroRaca(db, estado, genero, idMin, idMax, racasSel) {
  // Sem filtro de raça = neutro
  if (!racasSel || racasSel.length === 0) return 1;

  const base = safeGet(db, 'escolaridade', estado, genero);
  if (!base) {
    console.warn(`[calculator] raca: dados não encontrados para ${estado}/${genero}`);
    return 1;
  }

  const faixas = faixasNoIntervalo(FAIXAS_ESC, idMin, idMax);
  let totalGeral = 0;
  let totalSelecionado = 0;

  for (const { key, peso } of faixas) {
    for (const raca of TODAS_RACAS) {
      const faixa = safeGet(base, raca, key);
      if (!faixa) continue;
      const popFaixa = Object.values(faixa).reduce((s, v) => s + v, 0);
      totalGeral += popFaixa * peso;
      if (racasSel.includes(raca)) {
        totalSelecionado += popFaixa * peso;
      }
    }
  }

  if (totalGeral === 0) return 1;
  return clamp(totalSelecionado / totalGeral);
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 3 — RELIGIÃO
// ══════════════════════════════════════════════════════════════════

/**
 * Mapeamento das labels do formulário para as chaves do JSON.
 * Chaves do JSON: Catolica | Evangelica | Espirita | Matriz_Africana | Sem_Religiao
 */
const REL_CHAVE_MAP = {
  'Católica':       'Catolica',
  'Evangélica':     'Evangelica',
  'Espírita':       'Espirita',
  'Matriz Africana':'Matriz_Africana',
  'Sem Religião':   'Sem_Religiao',
};

/**
 * Calcula proporção que possui as religiões desejadas.
 * @param {Object}   db
 * @param {string}   estado
 * @param {string}   genero
 * @param {number}   idMin
 * @param {number}   idMax
 * @param {string[]} religioes  ex: ["Católica","Evangélica"]
 * @returns {number} proporção em [0,1]
 */
function calcularFiltroReligiao(db, estado, genero, idMin, idMax, religioes) {
  const base = safeGet(db, 'religiao', estado, genero);
  if (!base) {
    console.warn(`[calculator] religiao: dados não encontrados para ${estado}/${genero}`);
    return 1;
  }

  const chavesSel = religioes.map(r => REL_CHAVE_MAP[r]).filter(Boolean);
  if (chavesSel.length === 0) return 1;

  const faixas = faixasNoIntervalo(FAIXAS_REL, idMin, idMax);
  let numTotal = 0;
  let numSelecionado = 0;

  for (const { key, peso } of faixas) {
    const faixa = base[key];
    if (!faixa) continue;

    const totalFaixa = Object.values(faixa).reduce((s, v) => s + v, 0);
    const selFaixa   = chavesSel.reduce((s, ch) => s + (faixa[ch] ?? 0), 0);

    numTotal       += totalFaixa * peso;
    numSelecionado += selFaixa   * peso;
  }

  if (numTotal === 0) return 1;
  return clamp(numSelecionado / numTotal);
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 4 — RENDA
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula P(renda > rendaMin) usando a curva de percentis do renda.json.
 *
 * O JSON fornece os percentis P5…P99 (valor de renda em R$ para cada percentil).
 * Usamos interpolação linear entre os pontos conhecidos para estimar
 * em qual percentil cai o `rendaMin`, depois retornamos 1 − CDF(rendaMin).
 *
 * Exemplo: Se rendaMin = R$ 5.000 cai entre P80 (R$ 4.890) e P90 (R$ 7.406)
 * em São Paulo, interpolamos a posição e retornamos 1 − ~0.82 ≈ 18%.
 *
 * @param {Object} db
 * @param {string} estado    nome completo do estado
 * @param {number} rendaMin  valor em R$
 * @returns {number} proporção em [0,1]
 */
function calcularFiltroRenda(db, estado, rendaMin) {
  const row = safeGet(db, 'renda', estado);
  if (!row) {
    console.warn(`[calculator] renda: dados não encontrados para ${estado}`);
    return 1;
  }

  // Extrai valores dos percentis em ordem crescente
  const valores = RENDA_PERCENTIS.map(p => row[p] ?? 0);

  // Se a renda exigida é 0, todos passam
  if (rendaMin <= 0) return 1;

  // Se acima do P99, praticamente ninguém passa
  if (rendaMin > valores[valores.length - 1]) return clamp(1 - 0.99);

  // Se abaixo do P5, quase todos passam
  if (rendaMin <= valores[0]) return clamp(1 - RENDA_PROB[0]);

  // Interpolação linear entre os dois percentis mais próximos
  for (let i = 0; i < valores.length - 1; i++) {
    const v0 = valores[i],     v1 = valores[i + 1];
    const p0 = RENDA_PROB[i],  p1 = RENDA_PROB[i + 1];

    if (rendaMin >= v0 && rendaMin <= v1) {
      const frac = (rendaMin - v0) / (v1 - v0 || 1);
      const percentilEstimado = p0 + frac * (p1 - p0);
      return clamp(1 - percentilEstimado);
    }
  }

  return clamp(0.01); // fallback extremo
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 5 — OBESIDADE
// ══════════════════════════════════════════════════════════════════

/**
 * Mapeamento de faixa etária do usuário para as faixas do obesidade.json (Por_Idade).
 * "18 a 24 anos" | "25 a 39 anos" | "40 a 59 anos" | "60 anos ou mais"
 */
function getTaxaObesidade(db, estado, genero, idMin, idMax) {
  const porEstado = safeGet(db, 'obesidade', 'Por_Estado', estado, genero);
  const porIdade  = safeGet(db, 'obesidade', 'Por_Idade');

  // Calcula média ponderada das taxas por faixa etária, ajustada pelo estado
  const FAIXAS_OB = [
    { key: '18 a 24 anos',    min: 18, max: 24  },
    { key: '25 a 39 anos',    min: 25, max: 39  },
    { key: '40 a 59 anos',    min: 40, max: 59  },
    { key: '60 anos ou mais', min: 60, max: 120 },
  ];

  let taxaPonderada = 0;
  let pesoTotal = 0;

  for (const f of FAIXAS_OB) {
    if (f.max < idMin || f.min > idMax) continue;
    const peso = Math.min(f.max, idMax) - Math.max(f.min, idMin) + 1;
    const taxaFaixa = safeGet(porIdade, f.key, genero) ?? 0;
    taxaPonderada += taxaFaixa * peso;
    pesoTotal     += peso;
  }

  const taxaIdade = pesoTotal > 0 ? taxaPonderada / pesoTotal : 20;

  // Ajuste pelo estado: combina 60% taxa por idade + 40% taxa estadual
  const taxaEstado = porEstado ?? taxaIdade;
  return taxaIdade * 0.6 + taxaEstado * 0.4;
}

/**
 * Retorna P(não obeso) se o filtro estiver ativado, ou 1 (neutro) caso contrário.
 * @param {Object}  db
 * @param {string}  estado
 * @param {string}  genero
 * @param {number}  idMin
 * @param {number}  idMax
 * @param {boolean} excluir    true = "quero apenas não-obesos"
 * @returns {number} proporção em [0,1]
 */
function calcularFiltroObesidade(db, estado, genero, idMin, idMax, excluir) {
  if (!excluir) return 1;
  const taxa = getTaxaObesidade(db, estado, genero, idMin, idMax);
  return clamp((100 - taxa) / 100);
}

// ══════════════════════════════════════════════════════════════════
//  FILTRO 6 — ALTURA (Distribuição Normal / Curva de Gauss)
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula a mediana ponderada de altura para o grupo demográfico.
 * Usa os dados do altura.json e faz média ponderada entre as faixas sobrepostas.
 */
function getMedianaAltura(db, estado, genero, idMin, idMax) {
  const base = safeGet(db, 'altura', estado, genero);
  if (!base) return genero === 'Masculino' ? 171 : 159; // fallback nacional

  const faixas = faixasNoIntervalo(FAIXAS_ALT, idMin, idMax);
  let soma = 0;
  let pesoTotal = 0;

  for (const { key, peso } of faixas) {
    const val = base[key];
    if (val == null) continue;
    soma      += val * peso;
    pesoTotal += peso;
  }

  return pesoTotal > 0 ? soma / pesoTotal : (genero === 'Masculino' ? 171 : 159);
}

/**
 * P(altura > alturaRequerida) usando distribuição Normal.
 *
 * X ~ N(mediana, sigma²)
 * P(X > req) = 1 - Φ((req - mediana) / sigma)
 *
 * @param {Object} db
 * @param {string} estado
 * @param {string} genero
 * @param {number} idMin
 * @param {number} idMax
 * @param {number} alturaRequerida  em cm
 * @returns {number} proporção em [0,1]
 */
function calcularFiltroAltura(db, estado, genero, idMin, idMax, alturaRequerida) {
  const mediana = getMedianaAltura(db, estado, genero, idMin, idMax);
  const sigma   = SIGMA_ALTURA[genero] ?? 7;
  const prob    = 1 - normalCDF(alturaRequerida, mediana, sigma);
  return clamp(prob);
}

// ══════════════════════════════════════════════════════════════════
//  FUNÇÃO PRINCIPAL: calcularRaridade
// ══════════════════════════════════════════════════════════════════

/**
 * Executa o funil completo de probabilidades e retorna o resultado.
 *
 * @param {Object} filtros - Objeto com todos os parâmetros do usuário:
 *   {
 *     genero:           "Masculino" | "Feminino"
 *     estadoUF:         "SP" | "RJ" | ... (código de 2 letras)
 *     idadeMin:         number (18-79)
 *     idadeMax:         number (19-80)
 *     alturaMin:        number (150-210, em cm)
 *     rendaMin:         number (0-50000, em R$)
 *     estadoCivil:      string[]  ex: ["Solteiro","Divorciado"]
 *     escolaridade:     string[]  ex: ["medio","superior"]
 *     religiao:         string[]  ex: ["Católica","Evangélica"]
 *     excluirObesidade: boolean
 *   }
 *
 * @param {Object} db - Banco de dados retornado por dataService.loadAllData()
 *
 * @returns {{
 *   probabilidade:   number,   // float [0,1] — use × 100 para porcentagem
 *   fatores: {
 *     estadoCivil:   number,
 *     escolaridade:  number,
 *     religiao:      number,
 *     renda:         number,
 *     obesidade:     number,
 *     altura:        number,
 *   },
 *   estadoNome:      string,
 *   medianaAltura:   number,   // cm — para exibição no breakdown
 * }}
 */
export function calcularRaridade(filtros, db) {
  const {
    genero,
    estadoUF,
    idadeMin,
    idadeMax,
    alturaMin,
    rendaMin,
    raca          = [],
    estadoCivil,
    escolaridade,
    religiao,
    excluirObesidade,
  } = filtros;

  const estadoNome = UF_TO_NOME[estadoUF] ?? estadoUF;

  // Extrai as populações numéricas brutas do estado/genero
  const resultIdade = calcularFiltroIdade(db, estadoNome, genero, idadeMin, idadeMax);
  const popMassaTotal = resultIdade.popTotalAdultos;
  
  // ── FUNIL EXATO: Iteração ano a ano ──────────────────────────────
  // Avaliamos as probabilidades a cada ano específico. Isso garante que:
  // 1. Não haja paradoxo de Simpson (média colapsada perdendo correlação).
  // 2. A quantidade absoluta de compatíveis apenas aumente ao ampliar a faixa etária.
  let popMatchAbsoluta = 0;

  for (let age = idadeMin; age <= idadeMax; age++) {
    const popAgeInfo = calcularFiltroIdade(db, estadoNome, genero, age, age);
    const popAno = popAgeInfo.popSelecionada;
    if (popAno <= 0) continue;

    const pR = calcularFiltroRaca(db, estadoNome, genero, age, age, raca);
    const pC = calcularFiltroEstadoCivil(db, estadoNome, genero, age, age, estadoCivil);
    const pE = calcularFiltroEscolaridade(db, estadoNome, genero, age, age, escolaridade, raca);
    const pRel = calcularFiltroReligiao(db, estadoNome, genero, age, age, religiao);
    const pRen = calcularFiltroRenda(db, estadoNome, rendaMin); // Renda independe de age no json
    const pO = calcularFiltroObesidade(db, estadoNome, genero, age, age, excluirObesidade);
    const pA = calcularFiltroAltura(db, estadoNome, genero, age, age, alturaMin);

    const matchAno = popAno * pR * pC * pE * pRel * pRen * pO * pA;
    popMatchAbsoluta += matchAno;
  }

  // A probabilidade final é exatamente os sobreviventes / População Total de Adultos
  const probabilidadeReal = popMassaTotal > 0 ? clamp(popMatchAbsoluta / popMassaTotal) : 0;

  // ── FATORES AGREGADOS ──────────────────────────────────────────── 
  // Para manter os blocos lógicos visuais do front-end ("detalhamento por filtro"),
  // calculamos também as médias globais do funil (usado penas para exibição).
  const pRacaMedia = calcularFiltroRaca(db, estadoNome, genero, idadeMin, idadeMax, raca);
  const pCivilMedia = calcularFiltroEstadoCivil(db, estadoNome, genero, idadeMin, idadeMax, estadoCivil);
  const pEscMedia = calcularFiltroEscolaridade(db, estadoNome, genero, idadeMin, idadeMax, escolaridade, raca);
  const pRelMedia = calcularFiltroReligiao(db, estadoNome, genero, idadeMin, idadeMax, religiao);
  const pRenMedia = calcularFiltroRenda(db, estadoNome, rendaMin);
  const pObsMedia = calcularFiltroObesidade(db, estadoNome, genero, idadeMin, idadeMax, excluirObesidade);
  const pAltMedia = calcularFiltroAltura(db, estadoNome, genero, idadeMin, idadeMax, alturaMin);

  // ── Resultado final ──────────────────────────────────────────────
  const medianaAltura = getMedianaAltura(db, estadoNome, genero, idadeMin, idadeMax);

  return {
    probabilidade: Math.max(0, Math.min(1, probabilidadeReal)),
    popAbsoluta: Math.round(popMatchAbsoluta), // Pessoas finais que dão match
    popBaseTotal: Math.round(popMassaTotal),   // Universo total de adultos
    fatores: {
      idade:        resultIdade.proporcao,
      raca:         pRacaMedia,
      estadoCivil:  pCivilMedia,
      escolaridade: pEscMedia,
      religiao:     pRelMedia,
      renda:        pRenMedia,
      obesidade:    pObsMedia,
      altura:       pAltMedia,
    },
    estadoNome,
    medianaAltura,
  };
}
