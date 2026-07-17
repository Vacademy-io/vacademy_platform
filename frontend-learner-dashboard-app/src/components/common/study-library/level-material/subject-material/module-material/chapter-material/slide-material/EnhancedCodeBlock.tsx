import React from 'react';

interface EnhancedCodeBlockProps {
    code: string;
    language?: string;
    className?: string;
}

type TokenType = 'comment' | 'string' | 'keyword' | 'number' | 'plain';

interface Token {
    text: string;
    type: TokenType;
}

const KEYWORDS: Record<string, string[]> = {
    python: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'True', 'False', 'None', 'with', 'as', 'try', 'except', 'finally', 'raise', 'pass', 'break', 'continue', 'lambda', 'yield', 'async', 'await', 'global', 'nonlocal', 'print', 'del', 'is', 'assert', 'type'],
    javascript: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'new', 'this', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'of', 'in', 'delete', 'void', 'do', 'extends', 'super', 'static', 'get', 'set', 'yield'],
    typescript: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'new', 'this', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'of', 'in', 'delete', 'void', 'do', 'extends', 'super', 'static', 'interface', 'type', 'enum', 'namespace', 'abstract', 'as', 'readonly', 'never', 'any', 'string', 'number', 'boolean'],
    cpp: ['int', 'float', 'double', 'char', 'bool', 'void', 'return', 'if', 'else', 'for', 'while', 'class', 'struct', 'namespace', 'using', 'true', 'false', 'nullptr', 'new', 'delete', 'public', 'private', 'protected', 'virtual', 'const', 'static', 'template', 'auto', 'long', 'short', 'unsigned', 'signed', 'inline', 'extern', 'include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma', 'operator', 'this', 'throw', 'try', 'catch', 'do', 'switch', 'case', 'break', 'continue', 'default'],
    c: ['int', 'float', 'double', 'char', 'void', 'return', 'if', 'else', 'for', 'while', 'struct', 'typedef', 'const', 'static', 'extern', 'include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma', 'NULL', 'unsigned', 'signed', 'long', 'short', 'do', 'switch', 'case', 'break', 'continue', 'default', 'sizeof', 'enum', 'union'],
    arduino: ['void', 'int', 'float', 'char', 'bool', 'byte', 'String', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'setup', 'loop', 'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'delay', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'true', 'false', 'unsigned', 'long', 'const', 'static', 'Serial', 'millis', 'micros', 'attachInterrupt', 'noInterrupts', 'interrupts', 'sizeof', 'NULL', 'do', 'default'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'try', 'catch', 'finally', 'throw', 'throws', 'static', 'final', 'abstract', 'void', 'int', 'float', 'double', 'char', 'boolean', 'long', 'short', 'byte', 'null', 'true', 'false', 'this', 'super', 'import', 'package', 'instanceof', 'synchronized', 'volatile', 'native', 'enum'],
    python3: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'True', 'False', 'None', 'with', 'as', 'try', 'except', 'finally', 'raise', 'pass', 'break', 'continue', 'lambda', 'yield', 'async', 'await', 'global', 'nonlocal', 'print', 'del', 'is', 'assert', 'type'],
};

function buildKeywordSet(language: string): Set<string> {
    const lang = language.toLowerCase();
    const cppLike = ['cpp', 'c++', 'c', 'arduino', 'ino'];
    if (cppLike.includes(lang)) {
        return new Set([...(KEYWORDS['c'] || []), ...(KEYWORDS['cpp'] || []), ...(KEYWORDS['arduino'] || [])]);
    }
    if (lang === 'typescript' || lang === 'ts') {
        return new Set([...(KEYWORDS['javascript'] || []), ...(KEYWORDS['typescript'] || [])]);
    }
    return new Set(KEYWORDS[lang] || KEYWORDS['javascript'] || []);
}

function tokenize(code: string, language: string): Token[] {
    const keywords = buildKeywordSet(language);
    const tokens: Token[] = [];
    let i = 0;

    while (i < code.length) {
        const ch = code[i];
        const next = code[i + 1] ?? '';

        // C-style multi-line comment /* ... */
        if (ch === '/' && next === '*') {
            const start = i;
            i += 2;
            while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i = Math.min(i + 2, code.length);
            tokens.push({ text: code.slice(start, i), type: 'comment' });
            continue;
        }

        // C-style single-line comment //
        if (ch === '/' && next === '/') {
            const start = i;
            while (i < code.length && code[i] !== '\n') i++;
            tokens.push({ text: code.slice(start, i), type: 'comment' });
            continue;
        }

        // Python / shell comment #
        if (ch === '#') {
            const start = i;
            while (i < code.length && code[i] !== '\n') i++;
            tokens.push({ text: code.slice(start, i), type: 'comment' });
            continue;
        }

        // String literals
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            const start = i++;
            while (i < code.length) {
                if (code[i] === '\\') { i += 2; continue; }
                if (code[i] === quote) { i++; break; }
                i++;
            }
            tokens.push({ text: code.slice(start, i), type: 'string' });
            continue;
        }

        // Identifiers / keywords
        if (/[a-zA-Z_$]/.test(ch)) {
            const start = i;
            while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
            const word = code.slice(start, i);
            tokens.push({ text: word, type: keywords.has(word) ? 'keyword' : 'plain' });
            continue;
        }

        // Numbers (decimal, hex, binary, octal)
        if (/[0-9]/.test(ch)) {
            const start = i;
            while (i < code.length && /[0-9.xXa-fA-FbBoO_]/.test(code[i])) i++;
            tokens.push({ text: code.slice(start, i), type: 'number' });
            continue;
        }

        // Plain character (operators, punctuation, whitespace)
        tokens.push({ text: ch, type: 'plain' });
        i++;
    }

    return tokens;
}

const TOKEN_COLORS: Record<TokenType, string> = {
    comment: '#6a9955', // design-lint-ignore: syntax-highlight theme color
    string:  '#ce9178', // design-lint-ignore: syntax-highlight theme color
    keyword: '#569cd6', // design-lint-ignore: syntax-highlight theme color
    number:  '#b5cea8', // design-lint-ignore: syntax-highlight theme color
    plain:   '#d4d4d4', // design-lint-ignore: syntax-highlight theme color
};

export const EnhancedCodeBlock: React.FC<EnhancedCodeBlockProps> = ({ code, language = '', className = '' }) => {
    const tokens = tokenize(code, language.toLowerCase());
    const displayLang = language.trim().toUpperCase();

    return (
        <div className={`enhanced-code-block relative my-6 ${className}`}>
            <div
                className="absolute top-0 start-0 end-0 h-8 rounded-t-lg flex items-center px-4 select-none z-10"
                style={{ backgroundColor: '#2d2d2d' /* design-lint-ignore: code editor chrome color */ }}
            >
                <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
                {displayLang && (
                    <span className="ms-auto text-xs tracking-wide" style={{ color: '#858585' /* design-lint-ignore: code editor chrome color */ }}>
                        {displayLang}
                    </span>
                )}
            </div>
            <code
                className="block p-6 pt-12 rounded-lg overflow-x-auto font-mono text-sm leading-relaxed shadow-lg whitespace-pre"
                style={{ backgroundColor: '#1e1e1e' /* design-lint-ignore: code editor background (VS Code dark theme) */ }}
            >
                {tokens.map((token, idx) => (
                    <span key={idx} style={{ color: TOKEN_COLORS[token.type] }}>
                        {token.text}
                    </span>
                ))}
            </code>
        </div>
    );
};
