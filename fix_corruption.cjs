const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'ai-video-player', 'AIVideoPlayer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix space-hyphen corruption in Tailwind classes and elsewhere
// Matches space-hyphen-space and replaces with hyphen
// Be careful not to break "a - b" subtractions.
// Tailwind classes are usually within className="..." or in template literals.

// Strategy: Replace " - " with "-" only if it's not a subtraction.
// Actually, in this file, almost all " - " are corruptions.
// Let's look for specific Tailwind prefixes.
const prefixes = ['bg', 'text', 'border', 'rounded', 'px', 'py', 'm', 'p', 'w', 'h', 'flex', 'items', 'justify', 'inset', 'min', 'max', 'aspect', 'opacity', 'duration', 'translate', 'scale', 'top', 'bottom', 'left', 'right', 'z', 'grid', 'gap', 'cols', 'rows', 'space', 'ring', 'shadow', 'outline', 'animate', 'cursor', 'select', 'pointer', 'sticky', 'absolute', 'relative', 'fixed'];

prefixes.forEach(prefix => {
    const regex = new RegExp(`(${prefix})\\s*-\\s*`, 'g');
    content = content.replace(regex, '$1-');
});

// Fix spaces after hyphens in cases like "- lg" -> "-lg"
content = content.replace(/-\s+([a-zA-Z0-9]+)/g, '-$1');

// Fix spaces around ${ }
content = content.replace(/\${\s+/g, '${');
content = content.replace(/\s+}/g, '}');

// Fix " px" -> "px"
content = content.replace(/\s+px/g, 'px');

// Fix specific known corruptions from previous views
content = content.replace(/w - full/g, 'w-full');
content = content.replace(/h - full/g, 'h-full');
content = content.replace(/bg - black/g, 'bg-black');
content = content.replace(/rounded - lg/g, 'rounded-lg');
content = content.replace(/items - center/g, 'items-center');
content = content.replace(/justify - center/g, 'justify-center');
content = content.replace(/flex - col/g, 'flex-col');
content = content.replace(/bg - red - 50/g, 'bg-red-50');
content = content.replace(/bg - red - 200/g, 'bg-red-200');

fs.writeFileSync(filePath, content);
console.log('Fixed AIVideoPlayer.tsx corruptions');
