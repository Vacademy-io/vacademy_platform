const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'components', 'ai-video-player', 'AIVideoPlayer.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add processHtmlContent import
content = content.replace(
    'import { getLibraryScriptTags } from "./library-loader";',
    'import { getLibraryScriptTags } from "./library-loader";\nimport { processHtmlContent } from "./html-processor";'
);

// 2. Remove fixHtmlContent function (from `const fixHtmlContent = ...` to the line before `export const AIVideoPlayer`)
const fixHtmlStart = content.indexOf('const fixHtmlContent =');
const exportStart = content.indexOf('export const AIVideoPlayer');
if (fixHtmlStart > -1 && exportStart > -1) {
    content = content.slice(0, fixHtmlStart) + content.slice(exportStart);
}

// 3. Update activeFrames generation
content = content.replace(
    `      // OPTIMIZATION: Only update state if the frames have actually changed
      setActiveFrames(prev => {
        if (prev.length === framesToShow.length && prev.every((f, i) => f.id === framesToShow[i].id)) {
          return prev;
        }
        return framesToShow;
      });`,
    `      // Get ALL active frames at current time, sorted by z-index (lowest first for stacking)
      const processedFrames = framesToShow.map((frame, index) => ({
          ...frame,
          processedHtml: frame.html
              ? processHtmlContent(
                    frame.html,
                    (meta.content_type as any) || 'VIDEO',
                    index > 0
                )
              : '',
      }));

      // OPTIMIZATION: Only update state if the frames have actually changed
      setActiveFrames(prev => {
        if (prev.length === processedFrames.length && prev.every((f, i) => f.id === processedFrames[i].id)) {
          return prev;
        }
        return processedFrames;
      });`
);

// 4. Update iframe mapping
const oldPattern = /\{\[\.\.\.activeFrames\]\.sort\(\(a, b\) => \(a\.z \|\| 0\) - \(b\.z \|\| 0\)\)\.map\(\(frame, index\) => \{[\s\n]+const htmlDoc = `([^`]+)`;[\s\n]+const frameStyle = \{[\s\n]+left: 0,[\s\n]+top: 0,[\s\n]+width: '100%',[\s\n]+height: '100%',[\s\n]+zIndex: frame\.z \|\| 0,[\s\n]+\};[\s\n]+return \([\s\n]+<iframe(?:[^/]+)\/>[\s\n]+\);[\s\n]+\}\)[\s\n]+\} \)/g;

content = content.replace(oldPattern, `{[...activeFrames].sort((a, b) => (a.z || 0) - (b.z || 0)).map((frame, index) => {
              const frameStyle = {
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                position: 'absolute' as const,
                zIndex: frame.z || 0,
              };

              return (
                <iframe
                  ref={index === 0 ? iframeRef : null}
                  key={\`frame-\${frame.id}-\${index}\`}
                  srcDoc={frame.processedHtml}
                  className="border-0 bg-transparent absolute"
                  sandbox="allow-scripts allow-same-origin allow-modals"
                  title={\`AI Video Layer \${frame.id}\`}
                  style={{
                    backgroundColor: index === 0 ? "#ffffff" : "transparent",
                    pointerEvents: frame.id?.startsWith('branding-watermark') ? 'none' : 'auto',
                    ...frameStyle
                  }}
                  onLoad={() => {
                    // console.log('Iframe loaded:', frame.id);
                  }}
                  onError={(e) => {
                    console.error('Iframe error:', e);
                  }}
                />
              );
            })} )`);

fs.writeFileSync(targetFile, content);
console.log('Successfully updated AIVideoPlayer.tsx');
