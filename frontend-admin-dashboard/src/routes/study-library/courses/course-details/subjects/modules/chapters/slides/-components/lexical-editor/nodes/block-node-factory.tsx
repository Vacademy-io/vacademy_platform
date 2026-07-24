/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    $getNodeByKey,
    DecoratorNode,
    type DOMConversionMap,
    type DOMConversionOutput,
    type DOMExportOutput,
    type LexicalEditor,
    type LexicalNode,
    type NodeKey,
    type SerializedLexicalNode,
    type Spread,
} from 'lexical';
import type { JSX } from 'react';

/**
 * Factory for custom document blocks (flashcard, quiz, tabs, math, …).
 *
 * Every block is a DecoratorNode whose whole state is one JSON-serializable
 * `payload` object. Two serialization surfaces:
 *  - exportDOM/importDOM: the persisted HTML contract — MUST emit exactly the
 *    same `data-yoopta-type` / `data-*` shapes as the legacy Yoopta plugins,
 *    because the learner app (DocumentWithMermaid.tsx) hydrates from those
 *    selectors and the stored corpus round-trips through them.
 *  - exportJSON/importJSON: Lexical's internal state (copy/paste, history).
 *
 * Determinism matters: the unsaved-changes baseline is an exact string
 * compare, so buildExportDom must set attributes in a FIXED order and
 * produce identical markup for identical payloads.
 */

export interface BlockNodeConfig<T> {
    /** Lexical node type id (unique across the editor). */
    nodeType: string;
    /** Default payload for a freshly inserted block. */
    defaultPayload: T;
    /** Build the exported DOM element (the persisted HTML contract). */
    buildExportDom: (payload: T) => HTMLElement;
    /** Tag(s) importDOM should inspect (e.g. ['div'] or ['pre']). */
    importTags: string[];
    /** Given a candidate element, return the payload if this block claims it,
     *  else null. Runs for every element with a matching tag. */
    importMatch: (el: HTMLElement) => T | null;
    /** Conversion priority (default 2 — beat the generic tag converters). */
    importPriority?: 0 | 1 | 2 | 3 | 4;
    /** React editing UI rendered inside the editor. */
    Component: (props: {
        payload: T;
        setPayload: (next: T) => void;
        readOnly: boolean;
        nodeKey: NodeKey;
    }) => JSX.Element;
}

export interface BlockNodeClass<T> {
    NodeClass: any;
    $create: (payload?: T) => LexicalNode;
    $is: (node: LexicalNode | null | undefined) => boolean;
}

type SerializedBlockNode<T> = Spread<{ payload: T }, SerializedLexicalNode>;

export function createBlockNode<T>(config: BlockNodeConfig<T>): BlockNodeClass<T> {
    const {
        nodeType,
        defaultPayload,
        buildExportDom,
        importTags,
        importMatch,
        importPriority = 2,
        Component,
    } = config;

    class BlockNode extends DecoratorNode<JSX.Element> {
        __payload: T;

        static getType(): string {
            return nodeType;
        }

        static clone(node: BlockNode): BlockNode {
            return new BlockNode(node.__payload, node.__key);
        }

        constructor(payload?: T, key?: NodeKey) {
            super(key);
            this.__payload = payload ?? defaultPayload;
        }

        getPayload(): T {
            return this.getLatest().__payload;
        }

        setPayload(payload: T): void {
            const writable = this.getWritable();
            writable.__payload = payload;
        }

        // ---- Lexical JSON state ----
        static importJSON(serialized: SerializedBlockNode<T>): BlockNode {
            return new BlockNode(serialized.payload);
        }

        exportJSON(): SerializedBlockNode<T> {
            return {
                type: nodeType,
                version: 1,
                payload: this.getPayload(),
            };
        }

        // ---- Persisted HTML contract ----
        exportDOM(): DOMExportOutput {
            return { element: buildExportDom(this.getPayload()) };
        }

        static importDOM(): DOMConversionMap | null {
            const conversion = () => ({
                conversion: (el: HTMLElement): DOMConversionOutput | null => {
                    const payload = importMatch(el);
                    if (payload === null) return null;
                    return { node: new BlockNode(payload) };
                },
                priority: importPriority,
            });
            const map: DOMConversionMap = {};
            for (const tag of importTags) {
                map[tag] = (el: HTMLElement) => (importMatch(el) !== null ? conversion() : null);
            }
            return map;
        }

        // ---- Editor rendering ----
        createDOM(): HTMLElement {
            const el = document.createElement('div');
            el.className = 'lexical-block-node my-2';
            return el;
        }

        updateDOM(): boolean {
            return false;
        }

        isInline(): boolean {
            return false;
        }

        decorate(editor: LexicalEditor): JSX.Element {
            const nodeKey = this.getKey();
            const payload = this.getPayload();
            const setPayload = (next: T) => {
                editor.update(() => {
                    const self = $getNodeByKey(nodeKey);
                    if (self instanceof BlockNode) self.setPayload(next);
                });
            };
            return (
                <Component
                    payload={payload}
                    setPayload={setPayload}
                    readOnly={!editor.isEditable()}
                    nodeKey={nodeKey}
                />
            );
        }
    }

    const $create = (payload?: T): LexicalNode => new BlockNode(payload);
    const $is = (node: LexicalNode | null | undefined): boolean => node instanceof BlockNode;

    return { NodeClass: BlockNode, $create, $is };
}

/** Deterministic attribute setter — call with attributes in a FIXED order. */
export function setAttrs(el: HTMLElement, attrs: Array<[string, string]>): void {
    for (const [name, value] of attrs) el.setAttribute(name, value);
}
