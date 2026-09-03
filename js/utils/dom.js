/**
 * CULINA — DOM utilities
 * Safe element construction. API data is ONLY ever inserted as text nodes or
 * attributes (PRD §47 — no unsanitized innerHTML from third-party responses).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

export function svgEl(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

function applyAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      // Developer-authored, trusted markup ONLY. Never API content.
      node.innerHTML = value;
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) appendChildren(node, child);
    else if (child instanceof Node) node.append(child);
    else node.append(document.createTextNode(String(child)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/**
 * Lucide placeholder — replaced by an inline SVG on the next refreshIcons() pass.
 * Decorative by default (aria-hidden); give interactive icons a label at the
 * call site instead.
 */
export function icon(name, className = '') {
  return el('i', { 'data-lucide': name, class: className, 'aria-hidden': 'true' });
}

/** Mount an element, replacing existing content. */
export function mount(target, node) {
  clearNode(target);
  target.append(node);
  return target;
}
