// Extrae textos "fijos" (copy de UI) del código fuente para revisión.
// Heurística línea-a-línea: literales entre comillas y nodos de texto
// JSX que parecen lenguaje humano (no identificadores/clases/paths).
// Salida: TEXTOS_APP.md agrupado por fichero con nº de línea.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(process.cwd(), 'src');
const OUT = join(process.cwd(), 'TEXTOS_APP.md');

const SKIP_DIRS = new Set(['__tests__', 'node_modules']);
const SKIP_FILE = /\.(test|spec)\.|setupTests|vite-env|iconBarrel|iconRegistry|iconLoader/;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, acc);
    } else if (/\.(tsx?|)$/.test(name) && /\.(tsx|ts)$/.test(name) && !SKIP_FILE.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

// ¿La cadena parece copy humano y no código?
function looksHuman(s) {
  const t = s.trim();
  if (t.length < 2) return false;
  if (!/[a-záéíóúñ]/i.test(t)) return false;            // sin letras → fuera
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/i.test(t)) return false; // kebab/snake id
  if (/^[a-z][a-zA-Z0-9]*$/.test(t) && !/\s/.test(t)) return false; // camelCase token
  if (/^(tb:|ion-|--|#[0-9a-f]{3,8}$)/i.test(t)) return false;
  if (/^[./@]/.test(t)) return false;                   // paths / imports
  if (/^https?:\/\//i.test(t)) return false;            // urls
  if (/^[\w.-]+\.(tsx?|css|png|svg|json|webp|jpg)$/i.test(t)) return false;
  if (/(^|\s)(var\(|rgba?\(|px\b|rem\b|vh\b|vw\b|0x)/.test(t) && !/\s\w+\s\w+/.test(t)) return false;
  if (/^[A-Z0-9_]+$/.test(t)) return false;             // CONSTANTE
  if (/^\d[\d.,\s]*$/.test(t)) return false;            // solo números
  // código tipo "auth/invalid-email", "menu/only", paths sin espacios
  if (!/\s/.test(t) && /^[a-z][\w-]*\/[\w/-]+$/i.test(t)) return false;
  // lista de classNames: todo en minúscula kebab, con guion en algún
  // token y separadas por espacio (p.ej. "landing-input landing--pwd").
  if (/^[a-z0-9]+([- ][a-z0-9]+)*$/.test(t) && /-/.test(t) && /\s/.test(t)) return false;
  // un solo token kebab aunque tenga "--" (className suelta)
  if (/^[a-z0-9]+(-{1,2}[a-z0-9]+)+$/.test(t)) return false;
  // listas de classNames/ids: solo [a-z0-9], guiones y espacios, con
  // al menos un guion · el copy real lleva mayúscula, acento o
  // puntuación, así que esto no se come frases legítimas.
  if (/^[a-z0-9 -]+$/.test(t) && /-/.test(t)) return false;
  // exige una palabra de >=3 letras o un espacio entre palabras o acento
  return /[a-záéíóúñ]{3,}/i.test(t) && (/\s/.test(t) || /[áéíóúñ¿¡]/i.test(t) || t.length >= 4);
}

// Limpia un nodo de texto JSX (quita {expr}, llaves sueltas, espacios).
function cleanJsxText(s) {
  return s.replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
}

const STR_RE = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;
const JSX_TEXT_RE = />([^<>{}][^<>]*)</g;

const files = walk(ROOT).sort();
let md = `# Textos fijos de la app — para revisión\n\n`;
md += `Generado automáticamente desde \`src/\`. Cada entrada: \`L<línea>\` + el texto.\n`;
md += `Edítalos directamente en el fichero indicado (la ruta es un enlace relativo).\n`;
md += `Filtrado heurístico: puede colarse algún identificador o faltar algún string en template multilínea.\n\n`;
md += `Total ficheros con copy: se listan abajo.\n\n---\n\n`;

let totalStrings = 0;
const perFile = [];

for (const file of files) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits = [];
  const seen = new Set();
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    // saltar imports y comentarios de línea evidentes
    const trimmed = line.trim();
    if (/^(import|export)\s.*from\s/.test(trimmed)) return;
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return;

    let m;
    STR_RE.lastIndex = 0;
    while ((m = STR_RE.exec(line))) {
      const val = m[2];
      if (looksHuman(val)) {
        const key = `S:${val}`;
        if (!seen.has(key)) { seen.add(key); hits.push({ ln, kind: 'str', val }); }
      }
    }
    JSX_TEXT_RE.lastIndex = 0;
    while ((m = JSX_TEXT_RE.exec(line))) {
      const val = cleanJsxText(m[1]);
      if (looksHuman(val)) {
        const key = `J:${val}`;
        if (!seen.has(key)) { seen.add(key); hits.push({ ln, kind: 'jsx', val }); }
      }
    }
  });
  if (hits.length) {
    perFile.push({ rel, hits });
    totalStrings += hits.length;
  }
}

md = md.replace('Total ficheros con copy: se listan abajo.',
  `Ficheros con copy: **${perFile.length}** · cadenas detectadas: **${totalStrings}**.`);

// Índice
md += `## Índice\n\n`;
for (const { rel, hits } of perFile) {
  const anchor = rel.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  md += `- [${rel}](#${anchor}) — ${hits.length}\n`;
}
md += `\n---\n\n`;

for (const { rel, hits } of perFile) {
  const anchor = rel.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  md += `## ${rel}\n<a id="${anchor}"></a>\n\n`;
  for (const h of hits) {
    const tag = h.kind === 'jsx' ? '`jsx`' : '`str`';
    const safe = h.val.replace(/\|/g, '\\|').replace(/\r?\n/g, '↵');
    md += `- **L${h.ln}** ${tag} — ${safe}\n`;
  }
  md += `\n`;
}

writeFileSync(OUT, md, 'utf8');
console.log(`OK · ${perFile.length} ficheros · ${totalStrings} cadenas → ${OUT}`);
