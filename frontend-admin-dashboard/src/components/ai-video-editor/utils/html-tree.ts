/**
 * HTML → tree adapter for the editor's Layers tab.
 *
 * Parses an entry's HTML body into a hierarchical `LayerNode` tree, and
 * provides path-addressed mutators (style/attr/delete/duplicate/move) that
 * round-trip through DOMParser — same pattern as `html-text-editor.ts` and
 * `html-media-editor.ts`, but addressed by DOM path instead of flat index.
 *
 * Paths are arrays of child indices from `<body>`. They survive sibling
 * reorder within the same parent only between operations on different paths;
 * a single op should be applied and then the tree should be re-built before
 * the next op (the LayersTab does this via React state).
 */

export type LayerKind = 'text' | 'image' | 'video' | 'svg' | 'group' | 'other';

export interface LayerNode {
    /** Stable id derived from path — usable as React key. */
    id: string;
    tag: string;
    kind: LayerKind;
    /** Friendly label for the row: text snippet for text, src basename for
     *  media, classname or id for groups, otherwise the tag name. */
    label: string;
    children: LayerNode[];
    attrs: Record<string, string>;
    /** Inline style as a flat record (e.g. `{ left: '40%', color: '#fff' }`). */
    style: Record<string, string>;
    /** Path from `<body>`: child indices to walk to reach this element. */
    path: number[];
    /** Full text content for text-kind leaf nodes (used by the inspector to
     *  edit text without truncation). Undefined for non-text or group nodes. */
    textContent?: string;
}

const IGNORED_TAGS = new Set(['script', 'style', 'link', 'meta']);

function classifyKind(el: Element): LayerKind {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') return 'image';
    if (tag === 'video') return 'video';
    if (tag === 'svg') return 'svg';
    // Element whose only meaningful content is its own text → text node
    if (el.children.length === 0 && (el.textContent ?? '').trim().length > 0) {
        return 'text';
    }
    if (el.children.length > 0) return 'group';
    return 'other';
}

function readStyle(el: Element): Record<string, string> {
    const raw = el.getAttribute('style');
    if (!raw) return {};
    const out: Record<string, string> = {};
    for (const decl of raw.split(';')) {
        const trimmed = decl.trim();
        if (!trimmed) continue;
        const idx = trimmed.indexOf(':');
        if (idx <= 0) continue;
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (k) out[k] = v;
    }
    return out;
}

function readAttrs(el: Element): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(el.attributes)) {
        if (a.name === 'style') continue; // exposed via `style` field
        out[a.name] = a.value;
    }
    return out;
}

function makeLabel(el: Element, kind: LayerKind): string {
    const tag = el.tagName.toLowerCase();
    if (kind === 'text') {
        const t = (el.textContent ?? '').trim();
        return t.length > 32 ? t.slice(0, 30) + '…' : t || tag;
    }
    if (kind === 'image' || kind === 'video') {
        const src = el.getAttribute('src') ?? '';
        const basename = src.split('/').pop() ?? src;
        return basename.length > 28 ? basename.slice(0, 26) + '…' : basename || tag;
    }
    const id = el.getAttribute('id');
    if (id) return `#${id}`;
    const cls = el.getAttribute('class');
    if (cls) {
        const first = cls.split(/\s+/)[0];
        if (first) return `.${first}`;
    }
    return tag;
}

function* walkChildren(parent: Element): Generator<{ el: Element; index: number }> {
    let visibleIndex = 0;
    for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (!child) continue;
        if (IGNORED_TAGS.has(child.tagName.toLowerCase())) continue;
        yield { el: child, index: visibleIndex };
        visibleIndex++;
    }
}

function buildNode(el: Element, path: number[]): LayerNode {
    const kind = classifyKind(el);
    const children: LayerNode[] = [];
    if (kind !== 'text') {
        for (const { el: child, index } of walkChildren(el)) {
            children.push(buildNode(child, [...path, index]));
        }
    }
    return {
        id: path.join('.') || 'root',
        tag: el.tagName.toLowerCase(),
        kind,
        label: makeLabel(el, kind),
        children,
        attrs: readAttrs(el),
        style: readStyle(el),
        path,
        textContent: kind === 'text' ? el.textContent ?? '' : undefined,
    };
}

export function buildLayerTree(html: string): LayerNode[] {
    if (!html || !html.trim()) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;
    if (!body) return [];
    const out: LayerNode[] = [];
    for (const { el: child, index } of walkChildren(body)) {
        out.push(buildNode(child, [index]));
    }
    return out;
}

/** Walk down the parsed body to the element at `path`. Returns null if not found. */
function findElementAtPath(body: Element, path: number[]): Element | null {
    let cur: Element | null = body;
    for (const idx of path) {
        if (!cur) return null;
        const visibleChildren: Element[] = [];
        for (const c of Array.from(cur.children)) {
            if (!IGNORED_TAGS.has(c.tagName.toLowerCase())) visibleChildren.push(c);
        }
        cur = visibleChildren[idx] ?? null;
    }
    return cur;
}

function stringifyStyle(style: Record<string, string>): string {
    return Object.entries(style)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
}

function withParsedDoc<T>(
    html: string,
    fn: (body: HTMLBodyElement, doc: Document) => T
): {
    html: string;
    result: T;
} {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body as HTMLBodyElement;
    const result = fn(body, doc);
    return { html: body.innerHTML, result };
}

export function patchNodeStyle(
    html: string,
    path: number[],
    patch: Record<string, string | null>
): string {
    const out = withParsedDoc(html, (body) => {
        const el = findElementAtPath(body, path);
        if (!el) return;
        const current = readStyle(el);
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '') delete current[k];
            else current[k] = v;
        }
        const next = stringifyStyle(current);
        if (next) el.setAttribute('style', next);
        else el.removeAttribute('style');
    });
    return out.html;
}

export function patchNodeAttr(
    html: string,
    path: number[],
    attr: string,
    value: string | null
): string {
    const out = withParsedDoc(html, (body) => {
        const el = findElementAtPath(body, path);
        if (!el) return;
        if (value === null) el.removeAttribute(attr);
        else el.setAttribute(attr, value);
    });
    return out.html;
}

export function patchNodeText(html: string, path: number[], text: string): string {
    const out = withParsedDoc(html, (body) => {
        const el = findElementAtPath(body, path);
        if (!el) return;
        // Only safe to assign text on leaf-text nodes — guard against
        // accidentally wiping out a group's children.
        if (el.children.length === 0) {
            el.textContent = text;
        }
    });
    return out.html;
}

export function deleteNodeAtPath(html: string, path: number[]): string {
    const out = withParsedDoc(html, (body) => {
        const el = findElementAtPath(body, path);
        if (!el || !el.parentElement) return;
        el.parentElement.removeChild(el);
    });
    return out.html;
}

export function duplicateNodeAtPath(html: string, path: number[]): string {
    const out = withParsedDoc(html, (body) => {
        const el = findElementAtPath(body, path);
        if (!el || !el.parentElement) return;
        const clone = el.cloneNode(true) as Element;
        el.parentElement.insertBefore(clone, el.nextSibling);
    });
    return out.html;
}

export function moveNodeAtPath(html: string, path: number[], direction: 'up' | 'down'): string {
    const out = withParsedDoc(html, (body) => {
        const el = findElementAtPath(body, path);
        if (!el || !el.parentElement) return;
        const parent = el.parentElement;
        // Collect non-ignored siblings in the same order the tree exposes them
        const siblings: Element[] = [];
        for (const c of Array.from(parent.children)) {
            if (!IGNORED_TAGS.has(c.tagName.toLowerCase())) siblings.push(c);
        }
        const idx = siblings.indexOf(el);
        if (idx < 0) return;
        if (direction === 'up' && idx > 0) {
            const before = siblings[idx - 1];
            if (before) parent.insertBefore(el, before);
        } else if (direction === 'down' && idx < siblings.length - 1) {
            const after = siblings[idx + 1];
            if (after) parent.insertBefore(el, after.nextSibling);
        }
    });
    return out.html;
}

export type NewLayerKind = 'text' | 'image' | 'video' | 'group';

/**
 * Append a freshly-created layer as the last child of the node at
 * `parentPath` (or as the last top-level child of `<body>` when parentPath
 * is null/empty). Returns the new HTML and the path of the inserted node so
 * the caller can immediately select it.
 *
 * Defaults are picked so the new node is *visible* on the canvas without
 * further config: centered absolute positioning, sensible default size.
 */
export function insertChildLayer(
    html: string,
    parentPath: number[] | null,
    kind: NewLayerKind,
    options?: { src?: string; text?: string }
): { html: string; path: number[] } {
    const doc = new DOMParser().parseFromString(html || '<body></body>', 'text/html');
    const body = doc.body as HTMLBodyElement;
    const parent = parentPath && parentPath.length > 0 ? findElementAtPath(body, parentPath) : body;
    if (!parent) {
        return { html: body.innerHTML, path: [] };
    }
    const el = createNewLayerElement(doc, kind, options);
    parent.appendChild(el);

    // Compute the new node's path: the visible-child-index of the inserted
    // node within its parent, appended to the parent's path.
    let visibleIndex = -1;
    for (const c of Array.from(parent.children)) {
        if (IGNORED_TAGS.has(c.tagName.toLowerCase())) continue;
        visibleIndex++;
        if (c === el) break;
    }
    const newPath =
        parentPath && parentPath.length > 0 ? [...parentPath, visibleIndex] : [visibleIndex];
    return { html: body.innerHTML, path: visibleIndex >= 0 ? newPath : [] };
}

function createNewLayerElement(
    doc: Document,
    kind: NewLayerKind,
    options?: { src?: string; text?: string }
): Element {
    const baseStyle = 'position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);';
    if (kind === 'text') {
        const div = doc.createElement('div');
        div.setAttribute(
            'style',
            `${baseStyle}color:#ffffff;font-size:48px;font-weight:600;line-height:1.2;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,0.5);`
        );
        div.textContent = options?.text ?? 'New text';
        return div;
    }
    if (kind === 'image') {
        const img = doc.createElement('img');
        img.setAttribute('src', options?.src ?? '');
        img.setAttribute('alt', '');
        img.setAttribute('style', `${baseStyle}width:300px;height:auto;object-fit:contain;`);
        return img;
    }
    if (kind === 'video') {
        const v = doc.createElement('video');
        v.setAttribute('src', options?.src ?? '');
        v.setAttribute('autoplay', '');
        v.setAttribute('muted', '');
        v.setAttribute('loop', '');
        v.setAttribute('playsinline', '');
        v.setAttribute(
            'style',
            `${baseStyle}width:400px;height:auto;object-fit:cover;border-radius:8px;`
        );
        return v;
    }
    // group
    const div = doc.createElement('div');
    div.setAttribute(
        'style',
        `${baseStyle}width:300px;height:200px;background:rgba(99,102,241,0.15);border:1px dashed #6366f1;`
    );
    return div;
}

/** Whether `a` and `b` reference the same node. */
export function pathsEqual(a: number[] | null, b: number[] | null): boolean {
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}
