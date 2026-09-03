/**
 * CULINA — Static audits (run with: npm run audit).
 *   1. Relative imports resolve
 *   2. Every JS-referenced CSS class (incl. static parts of template
 *      literals) exists in the stylesheets
 *   3. Every icon() name exists in the installed lucide package
 *   4. Every route has a page loader; every internal href matches a route
 * Exit code 1 on any failure — usable as a CI gate.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log('  ✗', msg);
};
const ok = (msg) => console.log('  ✓', msg);

function* walkJs(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walkJs(path);
    else if (name.endsWith('.js')) yield path;
  }
}
const jsFiles = [...walkJs(join(ROOT, 'js'))];

/* 1 — imports */
console.log('\n1) Import resolution');
let importIssues = 0;
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  const re = /(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  for (const m of src.matchAll(re)) {
    const rel = m[1] || m[2];
    if (!existsSync(normalize(join(dirname(file), rel)))) {
      fail(`${file.replace(ROOT, '')} → ${rel}`);
      importIssues++;
    }
  }
}
if (!importIssues) ok(`all relative imports resolve (${jsFiles.length} files)`);

/* 2 — CSS classes */
console.log('\n2) CSS class coverage');
const css = readdirSync(join(ROOT, 'css'))
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(ROOT, 'css', f), 'utf8'))
  .join('\n');
const defined = new Set(css.match(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)?.map((s) => s.slice(1)) ?? []);

const used = new Map();
const classRe = /class:\s*'([^']*)'|class:\s*"([^"]*)"|classList\.(?:toggle|add|remove)\(['"]([^'"]+)['"]\)|class:\s*`([^`]*)`|querySelector\(\s*['"]\.([a-zA-Z][\w-]*)['"]\s*\)/g;
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(classRe)) {
    let value = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
    // Template literals: strip ${...} expressions entirely before tokenizing.
    value = value.replace(/\$\{[^}]*\}/g, ' ');
    for (let cls of value.split(/\s+/)) {
      if (!cls) continue;
      cls = cls.replace(/^\.+/, '').split(/[.:[>~]/)[0];
      if (!cls || cls.endsWith('-')) continue; // dynamic prefix (is-${type})
      if (!used.has(cls)) used.set(cls, new Set());
      used.get(cls).add(file.replace(ROOT, ''));
    }
  }
}
const missingCss = [...used.entries()].filter(([cls]) => !defined.has(cls));
if (missingCss.length) {
  for (const [cls, files] of missingCss) fail(`.${cls}  ← ${[...files].join(', ')}`);
} else {
  ok(`${used.size} distinct classes referenced, all defined in css/`);
}

/* 3 — icons */
console.log('\n3) Lucide icon names');
const lucide = (await import('lucide')).default ?? (await import('lucide'));
const lucideExports = new Set(Object.keys(await import('lucide')));
const iconRe = /icon\(\s*'([a-z0-9-]+)'|iconName:\s*'([a-z0-9-]+)'|icon:\s*'([a-z0-9-]+)'/g;
const icons = new Map();
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(iconRe)) {
    const name = m[1] ?? m[2] ?? m[3];
    if (!icons.has(name)) icons.set(name, new Set());
    icons.get(name).add(file.replace(ROOT, ''));
  }
}
const missingIcons = [...icons.entries()].filter(([name]) => {
  const pascal = name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return !lucideExports.has(pascal);
});
if (missingIcons.length) {
  for (const [name, files] of missingIcons) fail(`icon "${name}" ← ${[...files].join(', ')}`);
} else {
  ok(`${icons.size} icon names used, all present in lucide`);
}

/* 3b — icon registry membership: icons used in code must be registered in
   js/utils/icons.js (`const set = {...}`), or refreshIcons() drops them. */
{
  const iconsSrc = readFileSync(join(ROOT, 'js/utils/icons.js'), 'utf8');
  const setMatch = iconsSrc.match(/const set = \{([\s\S]*?)\n\};/);
  if (!setMatch) {
    fail('js/utils/icons.js: could not find `const set = {…}` block');
  } else {
    const registered = new Set([...setMatch[1].matchAll(/^\s{2}([A-Za-z0-9]+),?\s*$/gm)].map((m) => m[1]));
    const unregistered = [...icons.keys()].filter((name) => {
      const pascal = name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
      return !registered.has(pascal);
    });
    if (unregistered.length) {
      for (const name of unregistered) fail(`icon "${name}" is used but NOT registered in js/utils/icons.js — refreshIcons() will skip it`);
    } else {
      ok(`${icons.size} used icons all registered in js/utils/icons.js (${registered.size} in set)`);
    }
  }
}

/* 4 — routes & links */
console.log('\n4) Routes & internal links');
const { routes } = await import(join(ROOT, 'js/router.js'));
const { pageLoaders } = await import(join(ROOT, 'js/app.js'));
const routePaths = new Set(routes.map((r) => r.path));
const pages = new Set(routes.map((r) => r.page));

let routeIssues = 0;
for (const r of routes) {
  if (!pageLoaders[r.page]) {
    fail(`route ${r.path} has no page loader`);
    routeIssues++;
  }
}
for (const key of Object.keys(pageLoaders)) {
  if (!pages.has(key)) {
    fail(`page loader "${key}" matches no route`);
    routeIssues++;
  }
}
if (!routeIssues) ok(`${routes.length} routes ↔ ${Object.keys(pageLoaders).length} loaders`);

/* Internal hrefs in JS must match a route shape (ignoring query strings). */
function pathMatchesRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const route of routes) {
    const rx = new RegExp(`^${route.path.replace(/:[^/]+/g, '[^/]+')}$`);
    if (rx.test(clean)) return true;
  }
  return false;
}
const hrefRes = [
  /(?:href|navigate)\(\s*'([^']+)'/g,   // plain single-quoted strings
  /(?:href|navigate)\(\s*"([^"]+)"/g,   // plain double-quoted strings
  /(?:href|navigate)\(\s*`([^`$]*)`/g,  // backtick strings WITHOUT interpolation
];
let linkIssues = 0;
const skip = [/^https?:/, /^mailto:/, /^tel:/, /^#/, /^data:/];
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  for (const re of hrefRes) {
    for (const m of src.matchAll(re)) {
      let href = m[1];
      if (skip.some((s) => s.test(href))) continue;
      href = href.split('?')[0].split('#')[0];
      if (!href.startsWith('/')) continue;
      if (!pathMatchesRoute(href)) {
        fail(`${file.replace(ROOT, '')}: internal link "${m[1]}" matches no route`);
        linkIssues++;
      }
    }
  }
}
if (!linkIssues) ok('all static internal links resolve to routes');

console.log(failures ? `\nAUDIT FAILED — ${failures} issue(s)` : '\nAUDIT PASSED');
process.exit(failures ? 1 : 0);
