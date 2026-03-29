const fs = require('fs');
const jsPath = 'c:/Users/User/Desktop/Ideal-Calculator/js/calculator.js';
let content = fs.readFileSync(jsPath, 'utf8');

content = content.replace('export function calcularRaridade(filtros, db) {', 'function calcularRaridadeEstado(filtros, db) {');

const newFunction = `

/**
 * Interface principal. Se estadoUF === 'BR', itera sobre todos os estados
 * e consolida matematicamente os resultados do funil.
 */
export function calcularRaridade(filtros, db) {
  if (filtros.estadoUF !== 'BR') {
    return calcularRaridadeEstado(filtros, db);
  }

  // Lógica para 'Todo o Brasil'
  let somaPopAbsoluta = 0;
  let somaPopMassaTotal = 0;
  
  // Agregadores para médias ponderadas
  const aggFatores = {
    idade: 0, raca: 0, estadoCivil: 0, escolaridade: 0,
    religiao: 0, renda: 0, obesidade: 0, altura: 0
  };
  let aggMedianaAltura = 0;

  const ufs = Object.keys(UF_TO_NOME);

  for (const uf of ufs) {
    const res = calcularRaridadeEstado({ ...filtros, estadoUF: uf }, db);
    
    somaPopAbsoluta += res.popAbsoluta;
    somaPopMassaTotal += res.popBaseTotal;

    // Fatores são ponderados pela população base de cada estado (universo de adultos)
    const base = res.popBaseTotal;
    if (base > 0) {
      aggFatores.idade        += res.fatores.idade * base;
      aggFatores.raca         += res.fatores.raca * base;
      aggFatores.estadoCivil  += res.fatores.estadoCivil * base;
      aggFatores.escolaridade += res.fatores.escolaridade * base;
      aggFatores.religiao     += res.fatores.religiao * base;
      aggFatores.renda        += res.fatores.renda * base;
      aggFatores.obesidade    += res.fatores.obesidade * base;
      aggFatores.altura       += res.fatores.altura * base;
      
      aggMedianaAltura += res.medianaAltura * base;
    }
  }

  const probBR = somaPopMassaTotal > 0 ? somaPopAbsoluta / somaPopMassaTotal : 0;

  // Normaliza médias ponderadas
  if (somaPopMassaTotal > 0) {
    for (const key of Object.keys(aggFatores)) {
       aggFatores[key] /= somaPopMassaTotal;
    }
    aggMedianaAltura /= somaPopMassaTotal;
  } else {
    // defaults teóricos se nada for encontrado (segurança)
    aggMedianaAltura = filtros.genero === 'Masculino' ? 173 : 160;
  }

  return {
    probabilidade: Math.max(0, Math.min(1, probBR)),
    popAbsoluta: Math.round(somaPopAbsoluta),
    popBaseTotal: Math.round(somaPopMassaTotal),
    fatores: {
      idade:        aggFatores.idade,
      raca:         aggFatores.raca,
      estadoCivil:  aggFatores.estadoCivil,
      escolaridade: aggFatores.escolaridade,
      religiao:     aggFatores.religiao,
      renda:        aggFatores.renda,
      obesidade:    aggFatores.obesidade,
      altura:       aggFatores.altura,
    },
    estadoNome: 'Todo o Brasil',
    medianaAltura: aggMedianaAltura,
  };
}
`;

if (!content.includes("export function calcularRaridade(filtros, db) {")) {
  content += newFunction;
}

fs.writeFileSync(jsPath, content, 'utf8');
console.log('calculator.js updated successfully!');
