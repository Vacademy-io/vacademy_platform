/**
 * Sanitizes Mermaid code to fix common syntax issues
 * Based on admin dashboard implementation
 */
export function sanitizeMermaidCode(code: string): string {
    if (!code) return '';
    let sanitized = code.trim();
    
    // Remove any text that appears after common Mermaid ending patterns
    // This helps clean up incomplete extractions
    const endPatterns = [
        /\n\s*<-->/,  // Catches stray connection syntax at the end
        /\n\s*-->/,   // Catches incomplete arrows
    ];
    
    endPatterns.forEach(pattern => {
        const match = sanitized.match(pattern);
        if (match && match.index) {
            sanitized = sanitized.substring(0, match.index);
        }
    });

    // Fix 1: Quote labels with parentheses
    // Before: C[Azure App Service (Web App)]
    // After:  C["Azure App Service (Web App)"]
    sanitized = sanitized.replace(
        /([A-Za-z0-9_]+)\[([^\]]*\([^)]+\)[^\]]*)\]/g,
        (match, id, label) => {
            if (!label.startsWith('"') && !label.endsWith('"')) {
                return `${id}["${label}"]`;
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

