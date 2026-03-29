const fs = require('fs');
const htmlPath = 'c:/Users/User/Desktop/Ideal-Calculator/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const newFormBlock = `      <form id="filtros-form" class="form-col dashboard-card anim-fade-up" autocomplete="off">
        
        <div class="form-header">
          <h2 class="form-title">Painel de Parâmetros</h2>
          <button type="button" id="btn-reset" class="btn-reset">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Restaurar Padrões
          </button>
        </div>

        <div class="filters-container">
          <!-- 1 · Gênero -->
          <div class="filter-group">
            <p class="card-label">Gênero do parceiro buscado</p>
            <div class="gender-row">
              <label class="gender-option">
                <input type="radio" name="genero" id="genero-homem" value="Masculino" checked />
                <div class="gender-pill">
                  <span class="gender-icon">♂</span>
                  <span class="gender-text">Homem</span>
                </div>
              </label>
              <label class="gender-option">
                <input type="radio" name="genero" id="genero-mulher" value="Feminino" />
                <div class="gender-pill">
                  <span class="gender-icon">♀</span>
                  <span class="gender-text">Mulher</span>
                </div>
              </label>
            </div>
          </div>

          <!-- 2 · Estado (UF) -->
          <div class="filter-group">
            <p class="card-label">Região / Estado</p>
            <select id="estado" class="styled-select">
              <option value="BR" selected>Todo o Brasil</option>
              <option value="AC">Acre</option>
              <option value="AL">Alagoas</option>
              <option value="AP">Amapá</option>
              <option value="AM">Amazonas</option>
              <option value="BA">Bahia</option>
              <option value="CE">Ceará</option>
              <option value="DF">Distrito Federal</option>
              <option value="ES">Espírito Santo</option>
              <option value="GO">Goiás</option>
              <option value="MA">Maranhão</option>
              <option value="MT">Mato Grosso</option>
              <option value="MS">Mato Grosso do Sul</option>
              <option value="MG">Minas Gerais</option>
              <option value="PA">Pará</option>
              <option value="PB">Paraíba</option>
              <option value="PR">Paraná</option>
              <option value="PE">Pernambuco</option>
              <option value="PI">Piauí</option>
              <option value="RJ">Rio de Janeiro</option>
              <option value="RN">Rio Grande do Norte</option>
              <option value="RS">Rio Grande do Sul</option>
              <option value="RO">Rondônia</option>
              <option value="RR">Roraima</option>
              <option value="SC">Santa Catarina</option>
              <option value="SP">São Paulo</option>
              <option value="SE">Sergipe</option>
              <option value="TO">Tocantins</option>
            </select>
          </div>

          <!-- 3 · Faixa Etária -->
          <div class="filter-group">
            <div class="slider-header" style="margin-bottom: 2px;">
              <p class="card-label" style="margin-bottom:0">Faixa etária</p>
              <span class="slider-value" id="idade-range-text" style="font-size: 1.15rem;">Entre 25 e 35 anos</span>
            </div>
            
            <div class="dual-slider-container">
              <div class="slider-track" id="idade-track"></div>
              <input type="range" id="idade-min" class="dual-range" min="18" max="80" value="25" step="1" />
              <input type="range" id="idade-max" class="dual-range" min="18" max="80" value="35" step="1" />
            </div>
            
            <div class="slider-labels" style="margin-top: 10px;">
              <span>18 anos</span>
              <span>80 anos</span>
            </div>
          </div>

          <!-- 4 · Altura -->
          <div class="filter-group">
            <div class="slider-header">
              <p class="card-label" style="margin-bottom:0">Altura mínima</p>
              <span class="slider-value" id="altura-display">1,75m</span>
            </div>
            <input type="range" id="altura-slider" class="styled-range" min="150" max="210" value="175" step="1" />
            <div class="slider-labels">
              <span>1,50m</span>
              <span>1,80m</span>
              <span>2,10m</span>
            </div>
          </div>

          <!-- 5 · Renda -->
          <div class="filter-group">
            <div class="slider-header">
              <p class="card-label" style="margin-bottom:0">Renda mensal mínima</p>
              <span class="slider-value" id="renda-display">R$&nbsp;5.000</span>
            </div>
            <input type="range" id="renda-slider" class="styled-range" min="0" max="50000" value="5000" step="500" />
            <div class="slider-labels">
              <span>R$ 0</span>
              <span>R$ 25k</span>
              <span>R$ 50k</span>
            </div>
          </div>

          <!-- 6 · Cor ou Raça -->
          <div class="filter-group">
            <p class="card-label">Cor ou Raça</p>
            <div class="pills-group">
              <label class="pill-option">
                <input type="checkbox" name="raca" id="raca-branca" value="Branca" />
                <span class="pill-chip"><span class="pill-check"></span>Branca</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="raca" id="raca-parda" value="Parda" />
                <span class="pill-chip"><span class="pill-check"></span>Parda</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="raca" id="raca-preta" value="Preta" />
                <span class="pill-chip"><span class="pill-check"></span>Preta</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="raca" id="raca-asiatica" value="Amarela" />
                <span class="pill-chip"><span class="pill-check"></span>Asiática</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="raca" id="raca-indigena" value="Indígena" />
                <span class="pill-chip"><span class="pill-check"></span>Indígena</span>
              </label>
            </div>
            <p class="card-hint">Nenhuma selecionada = considera todas as raças.</p>
          </div>

          <!-- 7 · Estado Civil -->
          <div class="filter-group">
            <p class="card-label">Estado civil</p>
            <div class="pills-group">
              <label class="pill-option">
                <input type="checkbox" name="estado_civil" id="ec-solteiro" value="Solteiro" checked />
                <span class="pill-chip"><span class="pill-check"></span>Solteiro(a)</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="estado_civil" id="ec-divorciado" value="Divorciado" />
                <span class="pill-chip"><span class="pill-check"></span>Divorciado(a)</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="estado_civil" id="ec-casado" value="Casado" />
                <span class="pill-chip"><span class="pill-check"></span>Casado(a)</span>
              </label>
            </div>
          </div>

          <!-- 8 · Escolaridade -->
          <div class="filter-group">
            <p class="card-label">Escolaridade mínima</p>
            <div class="pills-group">
              <label class="pill-option">
                <input type="checkbox" name="escolaridade" id="esc-medio" value="medio" checked />
                <span class="pill-chip"><span class="pill-check"></span>Ensino Médio</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="escolaridade" id="esc-superior" value="superior" checked />
                <span class="pill-chip"><span class="pill-check"></span>Ensino Superior</span>
              </label>
            </div>
            <p class="card-hint">
              "Ensino Médio" inclui quem tem médio completo ou superior.
              Selecione apenas "Superior" para filtrar somente graduados.
            </p>
          </div>

          <!-- 9 · Religião -->
          <div class="filter-group">
            <p class="card-label">Religião</p>
            <div class="pills-group">
              <label class="pill-option">
                <input type="checkbox" name="religiao" id="rel-cat" value="Católica" checked />
                <span class="pill-chip"><span class="pill-check"></span>Católica</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="religiao" id="rel-eva" value="Evangélica" checked />
                <span class="pill-chip"><span class="pill-check"></span>Evangélica</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="religiao" id="rel-esp" value="Espírita" />
                <span class="pill-chip"><span class="pill-check"></span>Espírita</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="religiao" id="rel-ma" value="Matriz Africana" />
                <span class="pill-chip"><span class="pill-check"></span>Matriz Africana</span>
              </label>
              <label class="pill-option">
                <input type="checkbox" name="religiao" id="rel-sr" value="Sem Religião" />
                <span class="pill-chip"><span class="pill-check"></span>Sem Religião</span>
              </label>
            </div>
          </div>

          <!-- 10 · Filtro físico -->
          <div class="filter-group no-border">
            <div class="toggle-row">
              <div class="toggle-info">
                <h3 class="toggle-title">Excluir pessoas com obesidade</h3>
                <p class="toggle-desc">Aplica a taxa de obesidade por estado e faixa etária.</p>
              </div>
              <div class="toggle-wrap">
                <input type="checkbox" id="excluir-obesidade" />
                <label class="toggle-track" for="excluir-obesidade"></label>
              </div>
            </div>
          </div>
        </div>

      </form><!-- /form-col -->`;

const startIdx = html.indexOf('      <div class="form-col">');
const endIdx = html.indexOf('      </div><!-- /form-col -->') + '      </div><!-- /form-col -->'.length;

if(startIdx !== -1 && endIdx !== -1) {
  const finalHtml = html.slice(0, startIdx) + newFormBlock + html.slice(endIdx);
  fs.writeFileSync(htmlPath, finalHtml, 'utf8');
  console.log('SUCCESS');
} else {
  console.log('ERROR: bounds not found');
}
