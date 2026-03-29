/**
 * main.js — Controlador da Interface
 *
 * Responsabilidade única: gerenciar eventos da UI, ler o formulário,
 * acionar o dataService e o calculator, e atualizar o DOM com os resultados.
 *
 * NÃO contém lógica matemática. NÃO faz fetch diretamente.
 */

import { loadAllData, getDB } from './dataService.js';
import { calcularRaridade, UF_TO_NOME } from './calculator.js';

// ══════════════════════════════════════════════════════════════════
//  ESTADO DA APLICAÇÃO
// ══════════════════════════════════════════════════════════════════

let ultimoResultado = null;  // cache do último cálculo para o botão de compartilhar
let animacaoAtiva   = false; // trava para não disparar múltiplas animações simultâneas

// ══════════════════════════════════════════════════════════════════
//  LEITURA DO FORMULÁRIO
// ══════════════════════════════════════════════════════════════════

/**
 * Lê todos os inputs do formulário e retorna o objeto de filtros
 * compatível com calculator.calcularRaridade().
 */
function lerFiltros() {
  const genero = document.querySelector('input[name="genero"]:checked')?.value ?? 'Masculino';
  const estadoUF = document.getElementById('estado')?.value ?? 'BR';

  const idadeMin = Math.max(18, Math.min(79, parseInt(document.getElementById('idade-min')?.value) || 18));
  const idadeMax = Math.max(idadeMin + 1, Math.min(80, parseInt(document.getElementById('idade-max')?.value) || 35));

  const alturaMin = parseInt(document.getElementById('altura-slider')?.value) || 170;
  const rendaMin  = parseInt(document.getElementById('renda-slider')?.value)  || 0;

  const estadoCivil = Array.from(
    document.querySelectorAll('input[name="estado_civil"]:checked')
  ).map(cb => cb.value);

  // Radio de escolaridade: pode estar vazio quando nenhum está marcado
  const escolaridade = document.querySelector('input[name="escolaridade"]:checked')?.value ?? null;

  const religiao = Array.from(
    document.querySelectorAll('input[name="religiao"]:checked')
  ).map(cb => cb.value);

  const excluirObesidade = document.getElementById('excluir-obesidade')?.checked ?? false;

  const raca = Array.from(
    document.querySelectorAll('input[name="raca"]:checked')
  ).map(cb => cb.value);

  return {
    genero,
    estadoUF,
    idadeMin,
    idadeMax,
    alturaMin,
    rendaMin,
    // raca vazio = todas as raças
    raca,
    estadoCivil:      estadoCivil.length  > 0 ? estadoCivil  : ['Solteiro'],
    escolaridade,
    religiao:         religiao.length     > 0 ? religiao     : ['Católica','Evangélica','Espírita','Matriz Africana','Sem Religião'],
    excluirObesidade,
  };
}

// ══════════════════════════════════════════════════════════════════
//  FORMATADORES
// ══════════════════════════════════════════════════════════════════

function formatAltura(cm) {
  const m   = Math.floor(cm / 100);
  const dec = String(cm % 100).padStart(2, '0');
  return `${m},${dec}m`;
}

function formatRenda(v) {
  if (v === 0) return 'R$ 0';
  if (v >= 1000) {
    const k = v / 1000;
    return 'R$ ' + (Number.isInteger(k) ? k : k.toFixed(1)).toString().replace('.', ',') + 'k';
  }
  return 'R$ ' + v.toLocaleString('pt-BR');
}

function formatRendaFull(v) {
  return 'R$ ' + v.toLocaleString('pt-BR');
}

function formatPct(p) {
  const pct = p * 100;
  if (pct < 0.001) return '< 0,001%';
  if (pct < 0.01)  return pct.toFixed(3).replace('.', ',') + '%';
  if (pct < 1)     return pct.toFixed(2).replace('.', ',') + '%';
  return pct.toFixed(1).replace('.', ',') + '%';
}

function formatFator(f) {
  return (f * 100).toFixed(1).replace('.', ',') + '%';
}

// ══════════════════════════════════════════════════════════════════
//  ANIMAÇÃO DE CONTAGEM (Count-Up)
// ══════════════════════════════════════════════════════════════════

/**
 * Anima o número grande de `de` até `para` em `duracao` ms.
 * @param {number} de       valor inicial (float 0–100)
 * @param {number} para     valor final   (float 0–100)
 * @param {number} duracao  ms
 * @param {function} cb     chamado a cada frame com o valor corrente
 */
function animarContagem(de, para, duracao, cb) {
  if (animacaoAtiva) return; // evita sobreposição
  animacaoAtiva = true;

  const inicio = performance.now();

  // Easing: easeOutExpo para dar sensação dramática
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function tick(agora) {
    const t = Math.min((agora - inicio) / duracao, 1);
    const valor = de + (para - de) * easeOutExpo(t);
    cb(valor);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      cb(para);
      animacaoAtiva = false;
    }
  }

  requestAnimationFrame(tick);
}

// ══════════════════════════════════════════════════════════════════
//  ATUALIZAÇÃO DO DOM
// ══════════════════════════════════════════════════════════════════

/** Atualiza o fill colorido do slider (porção preenchida à esquerda) */
function atualizarFillSlider(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.background =
    `linear-gradient(to right, #c9a96e 0%, #c9a96e ${pct}%, #1a1a2e ${pct}%, #1a1a2e 100%)`;
}

/** Atualiza os displays de label dos sliders em tempo real */
function atualizarLabelsSliders() {
  const alturaVal = parseInt(document.getElementById('altura-slider')?.value || 170);
  const rendaVal  = parseInt(document.getElementById('renda-slider')?.value  || 0);

  const altEl = document.getElementById('altura-display');
  const renEl = document.getElementById('renda-display');
  if (altEl) altEl.textContent = formatAltura(alturaVal);
  if (renEl) renEl.textContent = formatRendaFull(rendaVal);

  const idMinEl = document.getElementById('idade-min');
  const idMaxEl = document.getElementById('idade-max');
  const rangeEl = document.getElementById('idade-range-text');
  
  if (rangeEl && idMinEl && idMaxEl) {
    rangeEl.textContent = `Entre ${idMinEl.value} e ${idMaxEl.value} anos`;
    
    // Atualiza a trilha do slider duplo
    const minVal = parseInt(idMinEl.value);
    const maxVal = parseInt(idMaxEl.value);
    const minP = ((minVal - 18) / (80 - 18)) * 100;
    const maxP = ((maxVal - 18) / (80 - 18)) * 100;
    
    // Atualiza o fill visual do dual slider de idade
    const fill = document.getElementById('idade-fill');
    if (fill) {
      fill.style.left  = minP + '%';
      fill.style.width = (maxP - minP) + '%';
    }
  }
}

/**
 * Renderiza o resultado no painel direito.
 * @param {Object} resultado  retorno de calcularRaridade()
 * @param {Object} filtros    filtros do formulário
 * @param {boolean} animado   true = dispara count-up; false = atualização silenciosa
 */
function renderizarResultado(resultado, filtros, animado = false) {
  const { probabilidade, fatores, estadoNome, medianaAltura } = resultado;
  const pct = probabilidade * 100;

  const generoLabel = filtros.genero === 'Masculino' ? 'homens' : 'mulheres';

  // ── Subtítulo ──────────────────────────────────────────────────
  const subtitulo = document.getElementById('result-subtitle');
  if (subtitulo) {
    subtitulo.innerHTML = `Apenas <strong class="text-white">${formatPct(probabilidade)}</strong>
      dos <strong class="text-white">${generoLabel}</strong> em
      <strong class="text-white">${estadoNome}</strong> atendem a todos os seus critérios.`;
  }

  // ── Big number & Absolute Match ────────────────────────────────
  const bigEl = document.getElementById('big-percentage');
  const absEl = document.getElementById('absolute-match');
  const propEl = document.getElementById('proporcao-destaque');
  const formatAbs = (val) => `≈ ${Math.round(val).toLocaleString('pt-BR')} pessoas`;

  // Cálculo da proporção: 1 em cada X [homens/mulheres] em [local]
  // Denominador = popBaseTotal, que já é a pop. do gênero no estado selecionado
  const proporcao = probabilidade > 0 && resultado.popBaseTotal > 0
    ? Math.round(resultado.popBaseTotal / resultado.popAbsoluta)
    : 0;
  const textoProporcao = proporcao > 0
    ? `Isso significa 1 em cada ${proporcao.toLocaleString('pt-BR')} ${generoLabel} em ${estadoNome}`
    : 'Praticamente ninguém atende a isso';

  if (bigEl) {
    if (animado) {
      const valorAnterior = ultimoResultado ? ultimoResultado.probabilidade * 100 : 0;
      animarContagem(valorAnterior, pct, 1400, (v) => {
        bigEl.textContent = formatPct(v / 100);
        if (absEl) absEl.textContent = formatAbs((v / 100) * resultado.popBaseTotal);
      });
    } else {
      bigEl.classList.remove('pop');
      void bigEl.offsetWidth; // reflow
      bigEl.classList.add('pop');
      bigEl.textContent = formatPct(probabilidade);
      if (absEl) absEl.textContent = formatAbs(resultado.popAbsoluta);
    }
  }

  // Atualiza proporção (sempre, fora do count-up)
  if (propEl) propEl.textContent = textoProporcao;

  // ── Progress bar ───────────────────────────────────────────────
  const progressEl = document.getElementById('progress-fill');
  if (progressEl) {
    // Escala log para melhor visualização (0.01% → 5%, 10% → 85%)
    const width = pct <= 0 ? 1 : Math.max(1, Math.min(98, Math.log10(pct + 0.001) * 30 + 91));
    progressEl.style.width = width + '%';
  }

  // ── Breakdown por fator ────────────────────────────────────────
  const bdMap = {
    'bd-idade':  { label: 'Faixa Etária',  val: fatores.idade        },
    'bd-raca':   { label: 'Raça',          val: fatores.raca         },
    'bd-civil':  { label: 'Estado Civil',  val: fatores.estadoCivil  },
    'bd-esc':    { label: 'Escolaridade',  val: fatores.escolaridade },
    'bd-rel':    { label: 'Religião',      val: fatores.religiao     },
    'bd-renda':  { label: 'Renda',         val: fatores.renda        },
    'bd-obesity':{ label: 'Peso',          val: fatores.obesidade    },
    'bd-altura': { label: 'Altura',        val: fatores.altura       },
  };

  for (const [id, { val }] of Object.entries(bdMap)) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatFator(val) + ' passam';
  }

  // Mediana de altura no breakdown
  const bdAltExtra = document.getElementById('bd-altura-media');
  if (bdAltExtra) {
    bdAltExtra.textContent = `Mediana local: ${formatAltura(Math.round(medianaAltura))}`;
  }

  // ── Fun fact dinâmico ─────────────────────────────────────────
  atualizarFunFact(pct);

  ultimoResultado = resultado;
}

const FUN_FACTS = [
  '📏 Diminuir a exigência de altura em 5cm pode dobrar o seu mercado instantaneamente.',
  '💰 A renda é o filtro que mais restringe: apenas ~10% dos brasileiros ganham acima de R$ 5k.',
  '📊 A combinação de filtros age como uma multiplicação — cada restrição reduz o total de forma drástica.',
  '🤔 Considere ampliar a faixa etária em 5 anos: pode aumentar suas opções em 30% ou mais.',
  '🗺️ Capitais como SP, RJ e DF concentram mais pessoas com alta renda e nível superior.',
  '🧬 A curva de Gauss mostra que maioria das pessoas está próxima da mediana de altura do estado.',
  '🧮 Com 5 filtros independentes cada um eliminando 50%, você já tem menos de 3% do mercado.',
];

let ultimoFact = -1;
function atualizarFunFact(pct) {
  const el = document.getElementById('fun-fact');
  if (!el) return;
  if (pct < 0.5) {
    el.textContent = '🚨 Seus critérios são extremamente seletivos. O mercado está quase zerado — tente relaxar alguns filtros.';
    return;
  }
  let idx;
  do { idx = Math.floor(Math.random() * FUN_FACTS.length); } while (idx === ultimoFact);
  ultimoFact = idx;
  el.textContent = FUN_FACTS[idx];
}

// ══════════════════════════════════════════════════════════════════
//  ESTADOS DE UI (loading, erro, pronto)
// ══════════════════════════════════════════════════════════════════

function mostrarLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function esconderLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.4s ease';
    setTimeout(() => overlay.classList.add('hidden'), 400);
  }
}

function mostrarErroCarregamento(mensagem) {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="text-center px-6">
      <div class="text-4xl mb-4">⚠️</div>
      <p class="text-red-400 font-bold text-lg mb-2">Erro ao carregar dados</p>
      <p class="text-slate-400 text-sm mb-4">${mensagem}</p>
      <p class="text-slate-500 text-xs">Certifique-se de servir a aplicação via HTTP (ex: Live Server).</p>
    </div>
  `;
}

function habilitarFormulario() {
  // Apenas finaliza interface de carregamento, menu já liberado via CSS
}

// ══════════════════════════════════════════════════════════════════
//  COMPARTILHAMENTO
// ══════════════════════════════════════════════════════════════════

function compartilhar() {
  if (!ultimoResultado) return;

  const filtros = lerFiltros();
  const pctStr  = formatPct(ultimoResultado.probabilidade);
  const genLabel = filtros.genero === 'Masculino' ? 'homens' : 'mulheres';
  const text = `😱 Meu choque de realidade: apenas ${pctStr} dos ${genLabel} em ${ultimoResultado.estadoNome} atendem a todos os meus critérios!\n\nCalcule o seu: ${window.location.href}`;

  const shareBtn = document.getElementById('share-btn');

  if (navigator.share) {
    navigator.share({ title: 'Calculadora de Choque de Realidade', text })
      .catch(() => copiarParaClipboard(text, shareBtn));
  } else {
    copiarParaClipboard(text, shareBtn);
  }
}

function copiarParaClipboard(texto, btn) {
  navigator.clipboard.writeText(texto).then(() => {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = '✅ Copiado para a área de transferência!';
    btn.style.background = 'linear-gradient(135deg,#00ff87,#00c26e)';
    btn.style.color = '#000';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.style.color = '';
    }, 2800);
  }).catch(() => alert('Não foi possível copiar. Selecione o resultado e copie manualmente.'));
}

// ══════════════════════════════════════════════════════════════════
//  DEBOUNCE (evita cálculos excessivos nos sliders)
// ══════════════════════════════════════════════════════════════════

function debounce(fn, ms = 250) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ══════════════════════════════════════════════════════════════════
//  GATILHO DE CÁLCULO
// ══════════════════════════════════════════════════════════════════

/** Executa o cálculo e atualiza a tela. */
function executarCalculo(animado = false) {
  const db = getDB();
  if (!db) return;

  const filtros = lerFiltros();

  // Validação mínima
  if (!filtros.estadoUF) {
    document.getElementById('result-subtitle').textContent = 'Selecione um estado para começar.';
    return;
  }

  try {
    const resultado = calcularRaridade(filtros, db);
    renderizarResultado(resultado, filtros, animado);
  } catch (err) {
    console.error('[main] Erro no cálculo:', err);
  }
}

// ══════════════════════════════════════════════════════════════════
//  REGISTRO DE EVENTOS
// ══════════════════════════════════════════════════════════════════

function registrarEventos() {
  const calcDebounced = debounce(() => executarCalculo(false), 220);

  // ── Gênero ────────────────────────────────────────────────────
  document.querySelectorAll('input[name="genero"]').forEach(radio => {
    radio.addEventListener('change', calcDebounced);
  });

  // ── Estado ────────────────────────────────────────────────────
  document.getElementById('estado')?.addEventListener('change', () => executarCalculo(false));

  // ── Faixa etária ──────────────────────────────────────────────
  const idMin = document.getElementById('idade-min');
  const idMax = document.getElementById('idade-max');

  idMin?.addEventListener('input', () => {
    let v = parseInt(idMin.value) || 18;
    const maxV = parseInt(idMax.value) || 35;
    if (v >= maxV) idMin.value = Math.max(18, maxV - 1);
    atualizarLabelsSliders();
    calcDebounced();
  });

  idMax?.addEventListener('input', () => {
    let v = parseInt(idMax.value) || 35;
    const minV = parseInt(idMin.value) || 18;
    if (v <= minV) idMax.value = Math.min(80, minV + 1);
    atualizarLabelsSliders();
    calcDebounced();
  });

  // ── Slider de altura ──────────────────────────────────────────
  const alturaSlider = document.getElementById('altura-slider');
  alturaSlider?.addEventListener('input', () => {
    atualizarFillSlider(alturaSlider);
    document.getElementById('altura-display').textContent =
      formatAltura(parseInt(alturaSlider.value));
    calcDebounced();
  });

  // ── Slider de renda ───────────────────────────────────────────
  const rendaSlider = document.getElementById('renda-slider');
  rendaSlider?.addEventListener('input', () => {
    atualizarFillSlider(rendaSlider);
    document.getElementById('renda-display').textContent =
      formatRendaFull(parseInt(rendaSlider.value));
    calcDebounced();
  });

  // ── Escolaridade: toggle (radio com deselect) ─────────────────
  document.querySelectorAll('input[name="escolaridade"]').forEach(radio => {
    radio.addEventListener('click', () => {
      if (radio.dataset.wasChecked === 'true') {
        // Segundo clique na opção já ativa — desseleciona
        radio.checked = false;
        radio.dataset.wasChecked = 'false';
      } else {
        // Marca este e reseta estado dos demais
        document.querySelectorAll('input[name="escolaridade"]').forEach(r => {
          r.dataset.wasChecked = 'false';
        });
        radio.dataset.wasChecked = 'true';
      }
      calcDebounced();
    });
  });

  // ── Checkboxes (estado_civil, religião, raça) ──────────────────
  ['estado_civil', 'religiao', 'raca'].forEach(name => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
      cb.addEventListener('change', calcDebounced);
    });
  });

  // ── Toggle obesidade ──────────────────────────────────────────
  document.getElementById('excluir-obesidade')?.addEventListener('change', calcDebounced);

  // ── Botão Restaurar Padrões ───────────────────────────────────
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    const form = document.getElementById('filtros-form');
    if (form) form.reset();

    // Força update visual dos sliders e displays customizados
    const alturaSlider = document.getElementById('altura-slider');
    const rendaSlider  = document.getElementById('renda-slider');
    if (alturaSlider) atualizarFillSlider(alturaSlider);
    if (rendaSlider)  atualizarFillSlider(rendaSlider);
    atualizarLabelsSliders();

    executarCalculo(true); // chama com animação para feedback tátil de reset
  });

  // ── Botão Compartilhar ────────────────────────────────────────
  document.getElementById('share-btn')?.addEventListener('click', compartilhar);
}

// ══════════════════════════════════════════════════════════════════
//  INIT — ponto de entrada da aplicação
// ══════════════════════════════════════════════════════════════════

async function init() {
  mostrarLoading();

  // Inicializa fills dos sliders
  const alturaSlider = document.getElementById('altura-slider');
  const rendaSlider  = document.getElementById('renda-slider');
  if (alturaSlider) atualizarFillSlider(alturaSlider);
  if (rendaSlider)  atualizarFillSlider(rendaSlider);
  atualizarLabelsSliders();

  try {
    await loadAllData();
    esconderLoading();
    habilitarFormulario();
    registrarEventos();

    // Cálculo inicial silencioso
    executarCalculo(false);

  } catch (err) {
    console.error('[main] Falha crítica ao carregar dados:', err);
    mostrarErroCarregamento(err.message ?? 'Erro desconhecido');
  }
}

// Aguarda o DOM estar completamente pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
