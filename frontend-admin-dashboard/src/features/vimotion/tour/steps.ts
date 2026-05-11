import type { Step } from 'react-joyride';
import type { VimTourId } from './storage';

// Each tour is a list of Joyride steps targeting `[data-tour="..."]` anchors.
// Anchors must exist in the DOM at step-show time — the provider waits for
// the route/tab to settle before starting a tour, but if a step targets a
// popover-only element, the tour driver opens the popover first via the
// `onTourEvent` hook on the relevant component.

export const VIM_TOURS: Record<VimTourId, Step[]> = {
    'vim-dashboard': [
        {
            target: '[data-tour="vim-sidebar"]',
            title: 'Welcome to Vimotion',
            content:
                'Your studio for AI-generated videos. This 30-second tour shows where everything lives — you can replay it any time from the help icon.',
            placement: 'right',
            disableBeacon: true,
        },
        {
            target: '[data-tour="vim-sidebar-create"]',
            title: 'Create',
            content:
                'Start a new video here. You describe what you want, pick voice / host / brand kit, and Vimotion plans, narrates, renders, and stitches it.',
            placement: 'right',
        },
        {
            target: '[data-tour="vim-sidebar-recent"]',
            title: 'Recent',
            content:
                'Every video you and your studio have generated, with status, preview, and a link into the editor.',
            placement: 'right',
        },
        {
            target: '[data-tour="vim-sidebar-avatars"]',
            title: 'Avatars',
            content:
                'Saved hosts. Add a custom avatar from a face image or pick a built-in Argil / VEED avatar — then drop it into any video.',
            placement: 'right',
        },
        {
            target: '[data-tour="vim-sidebar-brand-kits"]',
            title: 'Brand Kits',
            content:
                'Palette, fonts, intro/outro, watermark — bundled. One default kit applies to every new video unless you override it.',
            placement: 'right',
        },
        {
            target: '[data-tour="vim-credits"]',
            title: 'AI credits',
            content:
                'Every generation deducts credits based on duration, voice, host avatar, and quality tier. The cost preview before you submit shows the exact charge.',
            placement: 'left',
        },
        {
            target: '[data-tour="vim-help"]',
            title: 'Replay any tour',
            content:
                'Forgot something? Open this menu to replay this tour or any of the area-specific tours (composer, editor, brand kit, avatars).',
            placement: 'left',
        },
    ],

    'vim-composer': [
        {
            target: '[data-tour="vim-composer-prompt"]',
            title: 'Describe your video',
            content:
                'Type a brief — topic, audience, tone, length. You can paste a script, upload a PDF, or attach reference images. The clearer the brief, the better the result.',
            placement: 'top',
            disableBeacon: true,
        },
        {
            target: '[data-tour="vim-composer-attach"]',
            title: 'Reference files',
            content:
                'Upload PDFs or images that should ground the video. Reference images influence the visual style; PDFs feed the script writer.',
            placement: 'top',
        },
        {
            target: '[data-tour="vim-composer-source-video"]',
            title: 'Source clips',
            content:
                'Optional: pick existing indexed videos to splice into the output. Useful for tutorials where you want real footage between AI scenes.',
            placement: 'top',
        },
        {
            target: '[data-tour="vim-composer-settings"]',
            title: 'Settings',
            content:
                'Tabs for output (orientation / duration / quality), voice (TTS provider, language, gender), host (AI presenter), and visuals (brand kit). Changes here override the studio defaults — only for this video.',
            placement: 'top',
        },
        {
            target: '[data-tour="vim-composer-send"]',
            title: 'Generate',
            content:
                "You'll see a cost preview first. Confirm to deduct credits and start the run — script → narration → visuals → render. You can navigate away; it keeps generating in the background.",
            placement: 'top',
        },
    ],

    'vim-brand-kit': [
        {
            target: '[data-tour="brand-kit-name"]',
            title: 'Name your kit',
            content:
                'Each studio can have many kits (e.g. "Default", "Workshop", "Investor deck"). Mark one as default — it applies to every new video unless overridden.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '[data-tour="brand-kit-colors"]',
            title: 'Palette',
            content:
                'Primary / secondary / accent / background. The renderer pulls from these for titles, lower-thirds, and motion graphics.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="brand-kit-fonts"]',
            title: 'Typography',
            content: 'Heading and body fonts. Supports Google Fonts plus your uploaded font files.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="brand-kit-media"]',
            title: 'Intro, outro, watermark',
            content:
                'Drop in a logo (PNG with transparency works best), an intro stinger, and an outro. Watermark position is configurable per kit.',
            placement: 'bottom',
        },
    ],

    'vim-avatar': [
        {
            target: '[data-tour="avatar-create"]',
            title: 'Add a host',
            content:
                'Two ways: upload a face image (custom — Vimotion uses Kling / VEED Fabric) or pick a built-in Argil / VEED avatar. Built-ins are faster and cheaper; custom feels personal.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '[data-tour="avatar-voice"]',
            title: 'Pair with a voice',
            content:
                'Bind a default TTS voice to each saved avatar. The composer auto-uses it when you pick that host — overridable per video.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="avatar-list"]',
            title: 'Pick from the composer',
            content:
                "Saved avatars show up in the composer's Host tab. Picking a saved host fills in the model, voice, and reference image automatically.",
            placement: 'top',
        },
    ],

    'vim-editor': [
        {
            target: '[data-tour="editor-toolbar"]',
            title: 'Welcome to the editor',
            content:
                'This is where you fine-tune a generated video — swap layers, retime shots, re-narrate sentences, add music, then render to MP4. Quick tour — about a minute.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '[data-tour="editor-entry-list"]',
            title: 'Shots',
            content:
                'Every shot in your video, top-to-bottom. Click one to focus the canvas and load its properties on the right. The eye icon marks the shot under the playhead.',
            placement: 'right',
        },
        {
            target: '[data-tour="editor-canvas"]',
            title: 'Canvas',
            content:
                'What the viewer sees. Click any element to select that layer — handles appear so you can drag to move, corner-drag to scale, and rotate. Arrow keys nudge.',
            placement: 'left',
        },
        {
            target: '[data-tour="editor-remake"]',
            title: 'Remake with AI',
            content:
                'Don\'t like the visuals of the selected shot? Click Remake, describe the change in plain English ("make the title blue, add a subtitle"), preview, then accept or discard. Only the selected shot is regenerated.',
            placement: 'left',
        },
        {
            target: '[data-tour="editor-properties-tabs"]',
            title: 'Properties tabs',
            content:
                'Layers (DOM tree of the shot), Transform (x/y/scale/rotation), Motion (keyframe animation), Text / Media / Overlays (typed editors), HTML (raw code). Whatever you change here is scoped to the selected shot.',
            placement: 'left',
        },
        {
            target: '[data-tour="editor-timeline"]',
            title: 'Timeline',
            content:
                "Click anywhere to seek. Drag a shot's left or right edge to resize its duration. The waveform underneath shows narration audio with one region per sentence.",
            placement: 'top',
        },
        {
            target: '[data-tour="editor-timeline"]',
            title: 'Re-narrate a sentence',
            content:
                'Click any sentence region on the waveform to open the sentence editor — change the text and Re-narrate. We TTS just that sentence, splice it in, and re-time the rest of the video automatically. This is the fastest way to fix a script error.',
            placement: 'top',
        },
        {
            target: '[data-tour="editor-audio-tracks"]',
            title: 'Audio tracks',
            content:
                'Add background music or extra voiceovers as separate tracks. Each track has volume, delay, and fade-in/out. Independent of the narration.',
            placement: 'top',
        },
        {
            target: '[data-tour="editor-add-shot"]',
            title: 'Add a shot or overlay',
            content:
                'These two buttons add a new shot from a prompt, or drop an image/video as a floating overlay onto the current shot.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="editor-save-render"]',
            title: 'Save, then render',
            content:
                'Save persists your edits to the backend (the badge counts unsaved shots). Render MP4 stitches everything — shots, narration, music, overlays, watermark — into a downloadable file. Preview toggles a full-screen play of the last saved version.',
            placement: 'bottom',
        },
    ],
};
