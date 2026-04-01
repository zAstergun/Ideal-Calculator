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
//  MAPA DE REGIÕES → ESTADOS
// ══════════════════════════════════════════════════════════════════

const REGIOES_MAP = {
  REG_N:  [['AC','Acre'],['AM','Amazonas'],['AP','Amapá'],['PA','Pará'],['RO','Rondônia'],['RR','Roraima'],['TO','Tocantins']],
  REG_NE: [['AL','Alagoas'],['BA','Bahia'],['CE','Ceará'],['MA','Maranhão'],['PB','Paraíba'],['PE','Pernambuco'],['PI','Piauí'],['RN','Rio Grande do Norte'],['SE','Sergipe']],
  REG_CO: [['DF','Distrito Federal'],['GO','Goiás'],['MS','Mato Grosso do Sul'],['MT','Mato Grosso']],
  REG_SE: [['ES','Espírito Santo'],['MG','Minas Gerais'],['RJ','Rio de Janeiro'],['SP','São Paulo']],
  REG_S:  [['PR','Paraná'],['RS','Rio Grande do Sul'],['SC','Santa Catarina']],
};

// Todos os estados em ordem alfabética (para quando região = BR)
const TODOS_ESTADOS = [
  ['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],
  ['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],
  ['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],
  ['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],
  ['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],
  ['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],
  ['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins'],
];

/**
 * Popula o #estado com base no valor atual de #regiao.
 * Sempre adiciona "Qualquer Estado" no topo.
 */
function atualizarDropdownEstados() {
  const regiaoEl = document.getElementById('regiao');
  const estadoEl = document.getElementById('estado');
  if (!regiaoEl || !estadoEl) return;

  const regiao = regiaoEl.value;
  const lista  = regiao === 'BR' ? TODOS_ESTADOS : (REGIOES_MAP[regiao] ?? []);

  // Limpa e insere "Qualquer Estado" fixo no topo
  estadoEl.innerHTML = '<option value="ALL">Qualquer Estado</option>';
  for (const [uf, nome] of lista) {
    const opt = document.createElement('option');
    opt.value       = uf;
    opt.textContent = nome;
    estadoEl.appendChild(opt);
  }
}

// ══════════════════════════════════════════════════════════════════
//  LEITURA DO FORMULÁRIO
// ══════════════════════════════════════════════════════════════════

/**
 * Lê todos os inputs do formulário e retorna o objeto de filtros
 * compatível com calculator.calcularRaridade().
 */
function lerFiltros() {
  const genero = document.querySelector('input[name="genero"]:checked')?.value ?? 'Masculino';

  // Cascading dropdowns: se estado selecionado for ALL, usa a região como escopo
  const regiaoVal = document.getElementById('regiao')?.value ?? 'BR';
  const estadoVal = document.getElementById('estado')?.value ?? 'ALL';
  const estadoUF  = estadoVal === 'ALL' ? regiaoVal : estadoVal;

  const idadeMin = Math.max(18, Math.min(79, parseInt(document.getElementById('idade-min')?.value) || 18));
  const idadeMax = Math.max(idadeMin + 1, Math.min(80, parseInt(document.getElementById('idade-max')?.value) || 80));

  const alturaMin = parseInt(document.getElementById('altura-slider')?.value) || 150;
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
  const excluirFumantes  = document.getElementById('excluir-fumantes')?.checked  ?? false;
  const excluirAlcool    = document.getElementById('excluir-alcool')?.checked    ?? false;
  const excluirFilhos    = document.getElementById('excluir-filhos')?.checked    ?? false;

  const raca = Array.from(
    document.querySelectorAll('input[name="raca"]:checked')
  ).map(cb => cb.value);

  const signo = Array.from(
    document.querySelectorAll('input[name="signo"]:checked')
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
    // signo vazio = todos os signos
    signo,
    estadoCivil:      estadoCivil.length  > 0 ? estadoCivil  : ['Solteiro', 'Casado', 'Divorciado'],
    escolaridade,
    religiao:         religiao.length     > 0 ? religiao     : ['Católica','Evangélica','Espírita','Matriz Africana','Sem Religião'],
    excluirObesidade,
    excluirFumantes,
    excluirAlcool,
    excluirFilhos,
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
    `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${pct}%, var(--bg-elevated) ${pct}%, var(--bg-elevated) 100%)`;
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
    'bd-fumo':   { label: 'Tabagismo',     val: fatores.fumo         },
    'bd-alcool': { label: 'Álcool',        val: fatores.alcool       },
    'bd-filhos': { label: 'Filhos',        val: fatores.filhos       },
    'bd-signo':  { label: 'Signo',         val: fatores.signo        },
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
  '🎓 No Brasil, menos de 20% da população adulta possui ensino superior completo.',
  '🚭 Apenas cerca de 12% da população brasileira é fumante ativa hoje em dia.',
  '📉 Filtros comportamentais (fumo, álcool, filhos) juntos podem reduzir seu mercado em até 70%.',
  '👰 O número de pessoas solteiras cai drasticamente após os 35 anos em quase todos os estados.',
  '⛪ A religião "Sem Religião" é o grupo que mais cresce entre jovens em grandes centros urbanos.',
  '✨ Como a distribuição de nascimentos é quase uniforme, filtrar por signo reduz seu mercado para ~8%.',
  '🚶 Pessoas que não consomem álcool são estatisticamente mais comuns no público feminino.',
  '👶 Acima dos 30 anos, mais de 60% da população brasileira já possui ao menos um filho.',
  '🏠 Morar em estados como SP ou MG aumenta drasticamente o número absoluto devido à alta densidade populacional.',
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

function prepararCardFantasma(filtros, resultado) {
  const prob = resultado.probabilidade;
  
  // 1. Diagnóstico de Nível
  let diagText = "";
  if (prob < 0.001) {
    diagText = "🤯 NÍVEL: DELIRANTE";
  } else if (prob < 0.01) {
    diagText = "🧐 NÍVEL: EXTREMAMENTE EXIGENTE";
  } else if (prob < 0.05) {
    diagText = "🍷 NÍVEL: ALTO PADRÃO";
  } else if (prob < 0.20) {
    diagText = "👍 NÍVEL: PÉ NO CHÃO";
  } else {
    diagText = "🕊️ NÍVEL: CORAÇÃO DE MÃE";
  }
  document.getElementById('share-diagnosis').textContent = diagText;

  // 2. Porcentagem Monstruosa
  document.getElementById('share-big-pct').textContent = formatPct(prob);

  // 3. Proporção com Copy Longa
  const proporcao = prob > 0 && resultado.popBaseTotal > 0 ? Math.round(resultado.popBaseTotal / resultado.popAbsoluta) : 0;
  if (proporcao > 0) {
    document.getElementById('share-proportion').textContent = `1 em cada ${proporcao.toLocaleString('pt-BR')} pessoas se encaixa no que eu estou buscando`;
  } else {
    document.getElementById('share-proportion').textContent = 'Quase impossível encontrar alguém com esse perfil';
  }

  // 4. Quantidade Absoluta Tangível
  const generoTexto = filtros.genero === 'Feminino' ? 'mulheres' : 'homens';
  document.getElementById('share-absolute-number').textContent = `Exatamente ${Math.round(resultado.popAbsoluta).toLocaleString('pt-BR')} ${generoTexto} em ${resultado.estadoNome}`;

  // 5. Link (dinâmico para o domínio)
  document.getElementById('share-url').textContent = window.location.hostname || 'idealcalc.app';
}

// ══════════════════════════════════════════════════════════════════
//  MODAL DE PARTILHA & VIRAL LOOP
// ══════════════════════════════════════════════════════════════════
let blobAtual = null;

async function abrirModalPreview() {
  if (!ultimoResultado || !window.html2canvas) return;
  const btn = document.getElementById('share-btn');
  const txtOriginal = btn.innerHTML;

  try {
    btn.innerHTML = '📸 A processar arte...';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
    
    prepararCardFantasma(lerFiltros(), ultimoResultado);
    
    const template = document.getElementById('share-template');
    
    // A MÁGICA: Não alteramos mais a opacidade no DOM real.
    const canvas = await html2canvas(template, { 
      scale: 1, 
      backgroundColor: '#050505', 
      logging: false,
      onclone: (clonedDoc) => {
        // Torna o card visível APENAS no clone de memória que será "fotografado"
        clonedDoc.getElementById('share-template').style.opacity = '1';
      }
    });
    
    blobAtual = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const imgUrl = URL.createObjectURL(blobAtual);

    document.getElementById('preview-img').src = imgUrl;
    document.getElementById('preview-modal').classList.remove('hidden');
  } catch (err) {
    console.error('Erro ao gerar imagem:', err);
    alert('Erro ao gerar a imagem. Tente novamente.');
  } finally {
    btn.innerHTML = txtOriginal;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
}

function fecharModal() {
  document.getElementById('preview-modal').classList.add('hidden');
  setTimeout(() => {
    const imgEl = document.getElementById('preview-img');
    if (imgEl.src) {
      URL.revokeObjectURL(imgEl.src);
      imgEl.src = '';
    }
    blobAtual = null;
    document.getElementById('share-status').textContent = '';
  }, 300);
}

async function executarAcaoPartilha(acaoFn) {
  const status = document.getElementById('share-status');
  status.textContent = 'A processar...';
  try {
    await acaoFn();
    status.textContent = '';
  } catch (e) {
    status.textContent = '❌ ' + (e.message || 'Erro na operação.');
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
}

// --- Ações dos 5 Botões ---
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function shareDownload() {
  await executarAcaoPartilha(async () => {
    if (!blobAtual) throw new Error("Imagem não encontrada.");
    const url = URL.createObjectURL(blobAtual);
    const a = document.createElement('a'); 
    a.href = url; a.download = 'meu-choque-de-realidade.png'; a.click();
    URL.revokeObjectURL(url);
  });
}

/**
 * Tenta compartilhar nativamente (Mobile). 
 * Se falhar ou não suportado (Desktop), copia para o clipboard e abre a URL.
 */
async function shareSmart(urlDestino, plataforma) {
  await executarAcaoPartilha(async () => {
    if (!blobAtual) throw new Error("Imagem não encontrada.");
    const status = document.getElementById('share-status');
    const file = new File([blobAtual], 'meu-choque-de-realidade.png', { type: 'image/png' });
    const shareData = {
      files: [file],
      title: 'Choque de Realidade',
      text: 'Olha só o meu resultado na Calculadora de Raridade! 😱',
      url: window.location.href
    };

    // 1. Tentar Share Nativo (Apenas se for Mobile e suportar arquivos)
    if (isMobile() && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share(shareData);
        return; // Sucesso
      } catch (err) {
        if (err.name === 'AbortError') return; // Usuário cancelou
        console.warn('Share nativo falhou, tentando clipboard...', err);
      }
    }

    // 2. Fallback: Clipboard + Abrir App (Ideal para Desktop e Mobile sem suporte a share de arquivo)
    try {
      const item = new ClipboardItem({ 'image/png': blobAtual });
      await navigator.clipboard.write([item]);
      status.textContent = '✅ Imagem copiada! Cole (Ctrl+V) na conversa.';
      
      // Delay pequeno para o usuário ler antes de abrir a aba
      setTimeout(() => { 
        if (urlDestino) window.open(urlDestino, '_blank'); 
      }, 1200);
    } catch (err) {
      throw new Error('O navegador bloqueou a cópia. Use o botão de Download.');
    }
  });
}

async function shareClipboardAndOpen(urlDestino) {
  // Mantido para compatibilidade se necessário, mas shareSmart é agora o padrão
  return shareSmart(urlDestino);
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

  // ── Região + Estado (cascading) ───────────────────────────────
  document.getElementById('regiao')?.addEventListener('change', () => {
    atualizarDropdownEstados();
    executarCalculo(false);
  });
  document.getElementById('estado')?.addEventListener('change', () => executarCalculo(false));

  // ── Faixa etária ──────────────────────────────────────────────
  const idMin = document.getElementById('idade-min');
  const idMax = document.getElementById('idade-max');

  idMin?.addEventListener('input', () => {
    let v = parseInt(idMin.value) || 18;
    const maxV = parseInt(idMax.value) || 80;
    if (v >= maxV) idMin.value = Math.max(18, maxV - 1);
    atualizarLabelsSliders();
    calcDebounced();
  });

  idMax?.addEventListener('input', () => {
    let v = parseInt(idMax.value) || 80;
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

  // ── Checkboxes (estado_civil, religião, raça, signo) ─────────
  ['estado_civil', 'religiao', 'raca', 'signo'].forEach(name => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
      cb.addEventListener('change', calcDebounced);
    });
  });

  // ── Toggle obesidade ──────────────────────────────────────────
  document.getElementById('excluir-obesidade')?.addEventListener('change', calcDebounced);

  // ── Toggles comportamentais e familiares ──────────────────────
  document.getElementById('excluir-fumantes')?.addEventListener('change', calcDebounced);
  document.getElementById('excluir-alcool')?.addEventListener('change', calcDebounced);
  document.getElementById('excluir-filhos')?.addEventListener('change', calcDebounced);

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

  // ── Botão Compartilhar (Abre Modal de Preview) ──────────────
  document.getElementById('share-btn')?.addEventListener('click', abrirModalPreview);
  document.getElementById('close-modal')?.addEventListener('click', fecharModal);
  document.getElementById('preview-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'preview-modal') fecharModal();
  });

  document.getElementById('btn-dl')?.addEventListener('click', shareDownload);
  document.getElementById('btn-wa')?.addEventListener('click', () => shareSmart('https://web.whatsapp.com/send?text=' + encodeURIComponent('Olha só meu resultado:'), 'whatsapp'));
  document.getElementById('btn-ig')?.addEventListener('click', () => shareSmart('https://www.instagram.com/', 'instagram'));
  document.getElementById('btn-tw')?.addEventListener('click', () => shareSmart('https://twitter.com/compose/tweet'));
  document.getElementById('btn-dc')?.addEventListener('click', () => shareSmart('https://discord.com/app'));

  // ── Botão Copiar Link ──────────────────────────────────────────
  document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
    const input = document.getElementById('copy-link-input');
    const btn = document.getElementById('btn-copy-link');
    if (!input || !btn) return;

    try {
      await navigator.clipboard.writeText(input.value);
      const originalText = btn.textContent;
      btn.textContent = 'Copiado! ✅';
      btn.style.background = '#28a745'; 
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  });
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
    atualizarDropdownEstados(); // popula #estado com base na região padrão (BR)
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

// ═ LÓGICA DO MODAL DE DOAÇÃO ═
document.addEventListener('DOMContentLoaded', () => {
  const btnOpen = document.getElementById('floating-donate-btn');
  const btnClose = document.getElementById('close-donate-modal');
  const modal = document.getElementById('donate-modal');
  const btnCopy = document.getElementById('copy-pix-btn');
  const inputPix = document.getElementById('pix-key-input');
  const feedback = document.getElementById('pix-feedback');

  // Lógica de Mute/Unmute do Vídeo do Gato
  const catVideo = document.getElementById('cat-video');
  const btnUnmute = document.getElementById('unmute-video-btn');

  function resetVideoMute() {
    if (catVideo) catVideo.muted = true;
    if (btnUnmute) {
      btnUnmute.textContent = '🔇';
      btnUnmute.setAttribute('title', 'Ativar Som');
    }
  }

  if (catVideo && btnUnmute) {
    btnUnmute.addEventListener('click', () => {
      catVideo.muted = !catVideo.muted;
      btnUnmute.textContent = catVideo.muted ? '🔇' : '🔊';
      btnUnmute.setAttribute('title', catVideo.muted ? 'Ativar Som' : 'Desativar Som');
    });
  }

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
      resetVideoMute();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        resetVideoMute();
      }
    });
  }

  if (btnCopy && inputPix) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(inputPix.value);
        btnCopy.textContent = 'Copiado!';
        btnCopy.style.background = '#25D366'; // Verde WhatsApp
        feedback.textContent = 'Código Pix copiado com sucesso! Cole no aplicativo do seu banco.';
        
        setTimeout(() => {
          btnCopy.textContent = 'Copiar';
          btnCopy.style.background = '';
          feedback.textContent = '';
        }, 3000);
      } catch (err) {
        // Fallback para navegadores antigos
        inputPix.select();
        document.execCommand('copy');
        btnCopy.textContent = 'Copiado!';
      }
    });
  }
});
