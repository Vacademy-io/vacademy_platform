import mermaid from 'mermaid';

let mermaidInitialized = false;

export const initializeMermaid = () => {
    if (!mermaidInitialized) {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            suppressErrorRendering: true,
            fontFamily: 'inherit',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis',
            },
            sequence: {
                useMaxWidth: true,
                actorMargin: 50,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35,
            },
            gantt: {
                useMaxWidth: true,
                barHeight: 20,
                barGap: 4,
                topPadding: 50,
                leftPadding: 75,
                gridLineStartPadding: 35,
                fontSize: 11,
            },
        });
        mermaidInitialized = true;
    }
};

