/**
 * Sanitize mermaid code to fix common syntax issues that cause parse errors
 */

export function sanitizeMermaidCode(code: string): string {
    if (!code) return '';

    let sanitized = code.trim();

    // Fix 1: Fix subgraph labels with parentheses
    // subgraph On-Premises (You manage everything) -> subgraph On-Premises["On-Premises (You manage everything)"]
    sanitized = sanitized.replace(/subgraph\s+([A-Za-z0-9_-]+)\s*\(([^)]+)\)/g, (match, label, text) => {
        const cleanLabel = label.trim();
        const fullText = `${cleanLabel} (${text})`;
        return `subgraph ${cleanLabel}["${fullText}"]`;
    });

    // Fix 2: Remove quoted strings from arrow connections (mermaid doesn't allow quoted strings in connections)
    // On-Premise --> "You Manage All" -> On-Premise --> N0["You Manage All"]
    // SaaS --> "Google Docs, Salesfo..." -> SaaS --> N1["Google Docs, Salesfo..."]
    // "Text" --> A -> N0["Text"] --> A
    // First, find all quoted strings in connections and create node definitions for them
    const quotedStringMap = new Map<string, string>();
    let nodeCounter = 0;
    
    // Helper function to get or create node ID for a quoted string
    const getNodeId = (text: string): string => {
        const nodeLabel = text.trim();
        if (quotedStringMap.has(nodeLabel)) {
            return quotedStringMap.get(nodeLabel)!;
        }
        const nodeId = `N${nodeCounter++}`;
        quotedStringMap.set(nodeLabel, nodeId);
        return nodeId;
    };
    
    // Replace quoted strings after arrows: --> "text"
    sanitized = sanitized.replace(/-->\s*"([^"]+)"/g, (match, text) => {
        const nodeId = getNodeId(text);
        return ` --> ${nodeId}`;
    });
    
    // Replace quoted strings before arrows: "text" -->
    sanitized = sanitized.replace(/"([^"]+)"\s*-->/g, (match, text) => {
        const nodeId = getNodeId(text);
        return `${nodeId} -->`;
    });
    
    // Replace quoted strings in other arrow types: --> "text" or "text" -->
    sanitized = sanitized.replace(/-\s*>\s*"([^"]+)"/g, (match, text) => {
        const nodeId = getNodeId(text);
        return ` --> ${nodeId}`;
    });
    
    sanitized = sanitized.replace(/"([^"]+)"\s*-\s*>/g, (match, text) => {
        const nodeId = getNodeId(text);
        return `${nodeId} -->`;
    });
    
    // Add node definitions after the graph declaration or at the beginning
    if (quotedStringMap.size > 0) {
        // Create node definitions
        const nodeDefs = Array.from(quotedStringMap.entries())
            .map(([label, id]) => `    ${id}["${label}"]`)
            .join('\n');
        
        // Try to find graph/flowchart declaration and insert after it (before any content)
        const graphMatch = sanitized.match(/^(graph\s+[A-Za-z]+\s*\n?)/);
        if (graphMatch) {
            // Insert after graph declaration, before any other content
            sanitized = sanitized.replace(/^(graph\s+[A-Za-z]+\s*\n?)(?!\s*[A-Za-z])/, `$1${nodeDefs}\n`);
            // If the above didn't work, try a simpler approach
            if (!sanitized.includes(nodeDefs)) {
                sanitized = sanitized.replace(/^(graph\s+[A-Za-z]+\s*\n?)/, `$1${nodeDefs}\n`);
            }
        } else {
            // Try flowchart
            const flowchartMatch = sanitized.match(/^(flowchart\s+[A-Za-z]+\s*\n?)/);
            if (flowchartMatch) {
                sanitized = sanitized.replace(/^(flowchart\s+[A-Za-z]+\s*\n?)/, `$1${nodeDefs}\n`);
            } else {
                // If no declaration found, add nodes at the beginning (after any leading whitespace)
                sanitized = sanitized.replace(/^(\s*)/, `$1${nodeDefs}\n`);
            }
        }
    }

    // Fix 3: Fix node labels with parentheses (must be quoted)
    // C[Azure App Service (Web App)] -> C["Azure App Service (Web App)"]
    // C{Azure Function(Data Processor)} -> C{"Azure Function(Data Processor)"}
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\[([^\]]*\([^)]+\)[^\]]*)\]/g, (match, id, label) => {
        // If label contains parentheses and isn't already quoted, quote it
        if (!label.startsWith('"') && !label.endsWith('"')) {
            return `${id}["${label}"]`;
        }
        return match;
    });
    
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\{([^}]*\([^)]+\)[^}]*)\}/g, (match, id, label) => {
        // If label contains parentheses and isn't already quoted, quote it
        if (!label.startsWith('"') && !label.endsWith('"')) {
            return `${id}{"${label}"}`;
        }
        return match;
    });

    // Fix 4: Remove markdown formatting (asterisks) from node labels and node IDs
    // Security *of* the Cloud -> Security of the Cloud
    // {Security *of* the Cloud} -> {Security of the Cloud}
    sanitized = sanitized.replace(/(\[[^\]]*)\*([^*]+)\*([^\]]*\])/g, (match, before, text, after) => {
        return `${before}${text}${after}`;
    });
    
    // Fix markdown in curly braces (diamond/decision nodes)
    sanitized = sanitized.replace(/(\{[^}]*)\*([^*]+)\*([^}]*\})/g, (match, before, text, after) => {
        return `${before}${text}${after}`;
    });

    // Fix markdown in node IDs (before brackets/braces)
    // A{Security *of* the Cloud} -> A{Security of the Cloud}
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\{([^}]*)\*([^*]+)\*([^}]*)\}/g, (match, id, before, text, after) => {
        return `${id}{${before}${text}${after}}`;
    });
    
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\[([^\]]*)\*([^*]+)\*([^\]]*)\]/g, (match, id, before, text, after) => {
        return `${id}[${before}${text}${after}]`;
    });

    // Fix 5: Ensure proper spacing around arrows and connections
    sanitized = sanitized.replace(/([A-Za-z0-9_&]+)\s*-->\s*([A-Za-z0-9_{])/g, '$1 --> $2');
    sanitized = sanitized.replace(/([A-Za-z0-9_&]+)\s*&/g, '$1 &');

    // Fix 6: Handle backticks and special characters in node labels
    // C[`print("Hello, World!")`] -> C["print(\"Hello, World!\")"]
    // Remove backticks and escape quotes in node labels
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\[`([^`]+)`\]/g, (match, id, label) => {
        // Escape quotes and wrap in quotes
        const escapedLabel = label.replace(/"/g, '\\"');
        return `${id}["${escapedLabel}"]`;
    });
    
    // Fix 7: Handle backticks in curly braces (decision nodes)
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\{`([^`]+)`\}/g, (match, id, label) => {
        // Escape quotes and wrap in quotes
        const escapedLabel = label.replace(/"/g, '\\"');
        return `${id}{"${escapedLabel}"}`;
    });

    // Fix 8: Quote node labels that contain backticks, quotes, or special characters that aren't already quoted
    // This handles cases like C[print("Hello")] or C[Assign "Alice" to `name`] where the label has quotes and backticks
    // Replace double quotes with single quotes to avoid escaping issues in mermaid
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\[([^\]]+)\]/g, (match, id, label) => {
        // If label contains backticks, quotes, or parentheses and isn't already quoted, quote it
        if (!label.startsWith('"') && !label.endsWith('"') && 
            (label.includes('"') || label.includes('`') || label.includes('(') || label.includes(')'))) {
            // Remove backticks and replace double quotes with single quotes (mermaid handles single quotes better)
            const cleanedLabel = label.replace(/`/g, '').replace(/"/g, "'");
            return `${id}["${cleanedLabel}"]`;
        }
        return match;
    });
    
    // Fix 9: Handle curly braces (decision nodes) with quotes and backticks
    sanitized = sanitized.replace(/([A-Za-z0-9_]+)\{([^}]+)\}/g, (match, id, label) => {
        // If label contains backticks, quotes, or parentheses and isn't already quoted, quote it
        if (!label.startsWith('"') && !label.endsWith('"') && 
            (label.includes('"') || label.includes('`') || label.includes('(') || label.includes(')'))) {
            // Remove backticks and replace double quotes with single quotes (mermaid handles single quotes better)
            const cleanedLabel = label.replace(/`/g, '').replace(/"/g, "'");
            return `${id}{"${cleanedLabel}"}`;
        }
        return match;
    });

    return sanitized;
}
