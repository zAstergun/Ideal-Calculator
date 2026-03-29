const fs = require('fs');
const cssPath = 'c:/Users/User/Desktop/Ideal-Calculator/css/style.css';
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace(/\.form-col \{\s*display: flex;\s*flex-direction: column;\s*gap: 12px;\s*\}/, 
`.form-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-card {
  background: rgba(20, 20, 34, 0.55);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-xl);
  padding: 28px 24px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.form-title {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--gold-light);
  letter-spacing: -0.01em;
}

.btn-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s;
}

.btn-reset:hover {
  color: var(--gold-base);
}

.btn-reset svg {
  width: 14px;
  height: 14px;
}

.filters-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}`);

css = css.replace(
/\.input-card \{[\s\S]*?\}\s*\.input-card:focus-within \{[\s\S]*?\}\s*\.card-step \{[\s\S]*?\}/,
`.filter-group {
  padding: 20px 0;
  border-bottom: 1px solid var(--border-subtle);
  transition: opacity 0.2s;
}

.filter-group:first-child {
  padding-top: 0;
}

.filter-group.no-border {
  border-bottom: none;
  padding-bottom: 0;
}

.filter-group:focus-within {
  opacity: 1;
}

.toggle-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.toggle-desc {
  font-size: 0.73rem;
  color: var(--text-muted);
  line-height: 1.5;
}
`);

// Remove old btn-primary safely if not used elsewhere, or just let it exist. Let's just remove it to clean up.
// btn-primary is from 687 to 750 roughly.
const btnPrimaryStart = css.indexOf('.btn-primary {');
if (btnPrimaryStart !== -1) {
  const btnIconStart = css.indexOf('.btn-icon {');
  if (btnIconStart !== -1) {
     const endIdx = css.indexOf('}', btnIconStart);
     if (endIdx !== -1) {
         css = css.substring(0, btnPrimaryStart) + css.substring(endIdx + 1);
     }
  }
}

fs.writeFileSync(cssPath, css, 'utf8');
console.log('style.css updated success');
