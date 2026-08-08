/**
 * Sanitizes Mermaid code to fix common syntax issues
 * Based on admin dashboard implementation
 */
export function sanitizeMermaidCode(code: string): string {
    if (!code) return '';
    let sanitized = code.trim();

    // Drop a DANGLING connector left behind by an incomplete extraction — an
    // arrow at the very end with nothing after it.
    // Only a TRAILING arrow is removed. This used to cut the code at the first
    // line that began with an arrow, which silently deleted the rest of any
    // diagram written with the (valid) wrapped style:
    //     flowchart TD
    //         A([PREPARE])
    //         --> B([SIGNAL])
    // leaving a single node that then rendered as one huge orphan box.
    const danglingConnector = /\n[ \t]*(<-->|<--|-->|---|-\.->|==>|===)[ \t]*$/;
    while (danglingConnector.test(sanitized)) {
        sanitized = sanitized.replace(danglingConnector, '');
    }

    // Fix 1: Quote labels with parentheses
    // Before: C[Azure App Service (Web App)]
    // After:  C["Azure App Service (Web App)"]
    sanitized = sanitized.replace(
        /([A-Za-z0-9_]+)\[([^\]]*\([^)]+\)[^\]]*)\]/g,
        (match, id, label) => {
            if (!label.startsWith('"') && !label.endsWith('"')) {
                const escapedLabel = label.replace(/"/g, "'");
                return `${id}["${escapedLabel}"]`;
            }
            return match;
        }
    );

    // Fix 2: Remove markdown formatting (asterisks)
    // Before: [Security *of* the Cloud]
    // After:  [Security of the Cloud]
    sanitized = sanitized.replace(
        /(\[[^\]]*)\*([^*]+)\*([^\]]*\])/g,
        (match, before, text, after) => `${before}${text}${after}`
    );

    // Fix 3: Handle backticks in labels
    // Before: C[`print("Hello")`]
    // After:  C["print('Hello')"]
    sanitized = sanitized.replace(
        /([A-Za-z0-9_]+)\[`([^`]+)`\]/g,
        (match, id, label) => {
            const escapedLabel = label.replace(/"/g, "'");
            return `${id}["${escapedLabel}"]`;
        }
    );

    // Fix 4: Quote labels with special characters
    // Before: C[print("Hello")]
    // After:  C["print('Hello')"]
    sanitized = sanitized.replace(
        /([A-Za-z0-9_]+)\[([^\]]+)\]/g,
        (match, id, label) => {
            if (!label.startsWith('"') && !label.endsWith('"') &&
                (label.includes('"') || label.includes('`') ||
                    label.includes('(') || label.includes(')'))) {
                const cleanedLabel = label.replace(/`/g, '').replace(/"/g, "'");
                return `${id}["${cleanedLabel}"]`;
            }
            return match;
        }
    );

    // Fix 5: Fix subgraph labels with parentheses
    // Before: subgraph On-Premises (You manage)
    // After:  subgraph On-Premises["On-Premises (You manage)"]
    sanitized = sanitized.replace(
        /subgraph\s+([A-Za-z0-9_-]+)\s*\(([^)]+)\)/g,
        (match, label, text) => {
            const cleanLabel = label.trim();
            const fullText = `${cleanLabel} (${text})`;
            return `subgraph ${cleanLabel}["${fullText}"]`;
        }
    );

    // Fix 6: Remove quoted strings from connections
    // Before: A --> "Text"
    // After:  A --> N0["Text"] (with N0 defined)
    const quotedStringMap = new Map<string, string>();
    let nodeCounter = 0;

    const getNodeId = (text: string): string => {
        if (quotedStringMap.has(text)) {
            return quotedStringMap.get(text)!;
        }
        const nodeId = `N${nodeCounter++}`;
        quotedStringMap.set(text, nodeId);
        return nodeId;
    };

    // Replace quoted strings after arrows
    sanitized = sanitized.replace(/-->\s*"([^"]+)"/g, (match, text) => {
        const nodeId = getNodeId(text);
        return ` --> ${nodeId}`;
    });

    // Replace quoted strings before arrows
    sanitized = sanitized.replace(/"([^"]+)"\s*-->/g, (match, text) => {
        const nodeId = getNodeId(text);
        return `${nodeId} -->`;
    });

    // Add node definitions
    if (quotedStringMap.size > 0) {
        const nodeDefs = Array.from(quotedStringMap.entries())
            .map(([label, id]) => `    ${id}["${label}"]`)
            .join('\n');

        const graphMatch = sanitized.match(/^(graph\s+[A-Za-z]+\s*\n?)/);
        if (graphMatch) {
            sanitized = sanitized.replace(/^(graph\s+[A-Za-z]+\s*\n?)/, `$1${nodeDefs}\n`);
        }
    }

    return sanitized;
}

