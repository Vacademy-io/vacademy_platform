/**
 * HTML Content Processor
 * Responsible for processing and fixing HTML content for different content types
 */

import { ContentType, Entry } from './types';

/**
 * Get the common libraries and styles for iframe content
 */
function getCommonLibraries(): string {
    return `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
        <script src="https://unpkg.com/rough-notation/lib/rough-notation.iife.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/vivus@0.4.6/dist/vivus.min.js"></script>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    `;
}

/**
 * Get base styles for all content types
 */
function getBaseStyles(): string {
    return `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&family=Fira+Code&display=swap');

            :root {
                --text-color: #1e293b;
                --text-secondary: #475569;
                --primary-color: #2563eb;
                --accent-color: #f59e0b;
                --background-color: #ffffff;
            }

            * { box-sizing: border-box; }

            html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                font-family: 'Inter', sans-serif;
                background: BODY_BACKGROUND_PLACEHOLDER;
                color: var(--text-color);
            }

            /* Ensure content is visible even if animations fail */
            body * {
                opacity: 1 !important;
                visibility: visible !important;
            }

            .text-display { font-family: 'Montserrat', sans-serif; font-size: 64px; font-weight: 800; line-height: 1.1; }
            .text-h2 { font-family: 'Montserrat', sans-serif; font-size: 48px; font-weight: 700; margin-bottom: 16px; }
            .text-body { font-family: 'Inter', sans-serif; font-size: 28px; font-weight: 400; line-height: 1.5; }
            .text-label { font-family: 'Fira Code', monospace; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; }

            .full-screen-center {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 60px 80px;
            }

            .highlight {
                background: linear-gradient(120deg, rgba(255, 226, 89, 0.6) 0%, rgba(255, 233, 148, 0.4) 100%);
                padding: 0 4px;
                border-radius: 4px;
            }

            .emphasis { color: var(--primary-color); font-weight: bold; }
            .mermaid { display: flex; justify-content: center; width: 100%; margin: 20px auto; }

            .layout-split {
                display: grid; grid-template-columns: 1fr 1fr; gap: 60px;
                width: 90%; max-width: 1700px; align-items: center;
            }
        </style>
    `;
}

/**
 * Get Ken Burns Effect Styles for Cinematic Video Generation
 */
function getKenBurnsStyles(): string {
    return `
        <style>
            /* ===== KEN BURNS CINEMATIC ENGINE ===== */

            /* IMAGE_HERO: Full-screen image background with text overlay */
            .image-hero {
              position: relative;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }

            .image-hero > img {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              transform-origin: center;
              will-change: transform;
              animation-duration: var(--kb-duration, 12s);
              animation-timing-function: linear;
              animation-fill-mode: both;
            }

            /* Text overlay container — sits on top of image */
            .image-text-overlay {
              position: absolute;
              inset: 0;
              display: flex;
              flex-direction: column;
              justify-content: flex-end;
              padding: 80px 100px;
              z-index: 2;
            }
            .image-text-overlay > * { position: relative; z-index: 1; }

            /* Gradient scrim for text legibility */
            .image-text-overlay.gradient-bottom::before,
            .image-text-overlay:not([class*="gradient-"])::before {
              content: "";
              position: absolute;
              inset: 0;
              background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, transparent 70%);
              pointer-events: none;
              z-index: 0;
            }
            .image-text-overlay.gradient-full::before {
              content: "";
              position: absolute; inset: 0;
              background: rgba(0,0,0,0.45);
              pointer-events: none; z-index: 0;
            }
            .image-text-overlay.gradient-center {
              justify-content: center;
              align-items: center;
              text-align: center;
            }
            .image-text-overlay.gradient-center::before {
              content: "";
              position: absolute; inset: 0;
              background: radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 70%);
              pointer-events: none; z-index: 0;
            }

            /* Hero text typography */
            .image-text-overlay h1, .image-text-overlay .hero-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 64px; font-weight: 800;
              color: #fff; line-height: 1.1;
              margin: 0 0 16px 0;
              text-shadow: 0 2px 20px rgba(0,0,0,0.3);
            }
            .image-text-overlay p, .image-text-overlay .hero-subtitle {
              font-family: 'Inter', sans-serif;
              font-size: 28px; color: rgba(255,255,255,0.9);
              line-height: 1.4; margin: 0; max-width: 800px;
            }

            /* IMAGE_SPLIT: Image one side, text the other */
            .image-split-layout {
              display: grid;
              grid-template-columns: 1fr 1fr;
              width: 100%; height: 100%;
              overflow: hidden;
            }
            .image-split-layout .split-image {
              position: relative; overflow: hidden;
            }
            .image-split-layout .split-image img {
              width: 100%; height: 100%;
              object-fit: cover;
              will-change: transform;
              animation-duration: var(--kb-duration, 12s);
              animation-timing-function: linear;
              animation-fill-mode: both;
            }
            .image-split-layout .split-text {
              display: flex; flex-direction: column;
              justify-content: center; padding: 60px 80px;
            }

            /* LOWER_THIRD: Key term banner */
            .lower-third {
              position: absolute;
              bottom: 120px; left: 100px;
              display: flex; align-items: stretch;
              animation: ltSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              z-index: 20;
            }
            .lower-third .lt-accent-bar {
              width: 6px;
              background: linear-gradient(180deg, #3b82f6, #8b5cf6);
              border-radius: 3px 0 0 3px;
            }
            .lower-third .lt-content {
              background: rgba(0,0,0,0.85);
              padding: 16px 32px;
              border-radius: 0 8px 8px 0;
              display: flex; flex-direction: column; gap: 4px;
            }
            .lower-third .lt-label {
              font-family: 'Fira Code', monospace;
              font-size: 12px; text-transform: uppercase;
              letter-spacing: 0.15em; color: #3b82f6; font-weight: 600;
            }
            .lower-third .lt-text {
              font-family: 'Inter', sans-serif;
              font-size: 24px; color: #fff; font-weight: 600;
            }
            @keyframes ltSlideIn {
              from { transform: translateX(-40px); opacity: 0; }
              to   { transform: translateX(0); opacity: 1; }
            }

            /* Ken Burns motion keyframes */
            .kb-zoom-in     { animation-name: kbZoomIn; }
            .kb-zoom-out    { animation-name: kbZoomOut; }
            .kb-pan-left    { animation-name: kbPanLeft; }
            .kb-pan-right   { animation-name: kbPanRight; }
            .kb-pan-up      { animation-name: kbPanUp; }
            .kb-zoom-pan-tl { animation-name: kbZoomPanTL; }

            @keyframes kbZoomIn    { from { transform: scale(1.0); }  to { transform: scale(1.15); } }
            @keyframes kbZoomOut   { from { transform: scale(1.20); } to { transform: scale(1.05); } }
            @keyframes kbPanLeft   { from { transform: scale(1.15) translateX(3%); }  to { transform: scale(1.15) translateX(-3%); } }
            @keyframes kbPanRight  { from { transform: scale(1.15) translateX(-3%); } to { transform: scale(1.15) translateX(3%); } }
            @keyframes kbPanUp     { from { transform: scale(1.15) translateY(3%); }  to { transform: scale(1.15) translateY(-3%); } }
            @keyframes kbZoomPanTL { from { transform: scale(1.0) translate(2%, 2%); } to { transform: scale(1.15) translate(-2%, -2%); } }

            /* Shot-level crossfade entrance */
            .shot-enter {
              animation: shotFadeIn 0.6s ease-out forwards;
            }
            @keyframes shotFadeIn {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
        </style>
    `;
}

/**
 * Get print-specific styles for WORKSHEET content
 */
function getWorksheetStyles(): string {
    return `
        <style>
            @media print {
                body { background: white !important; }
                .no-print, .nav-controls, .audio-player { display: none !important; }
                .worksheet-container { max-width: 100%; padding: 20px; }
                .worksheet-header { page-break-after: avoid; }
                .worksheet-section { page-break-inside: avoid; }
            }

            .worksheet-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 40px;
            }

            .answer-line {
                border-bottom: 2px solid #ccc;
                min-height: 40px;
                margin: 10px 0;
            }

            .checkbox-item {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 8px 0;
            }

            .checkbox-item input[type="checkbox"] {
                width: 20px;
                height: 20px;
            }
        </style>
    `;
}

/**
 * Get code playground specific styles
 */
function getCodePlaygroundStyles(): string {
    return `
        <style>
            .code-editor {
                font-family: 'Fira Code', monospace;
                background: #1e1e1e;
                color: #d4d4d4;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
            }

            .run-button {
                background: #10b981;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.2s;
            }

            .run-button:hover {
                background: #059669;
            }

            .output-panel {
                background: #0f172a;
                color: #22c55e;
                padding: 16px;
                border-radius: 8px;
                font-family: 'Fira Code', monospace;
                margin-top: 16px;
                min-height: 100px;
            }

            .hint-toggle {
                color: #3b82f6;
                cursor: pointer;
                text-decoration: underline;
            }
        </style>
    `;
}

/**
 * Get conversation/dialogue specific styles
 */
function getConversationStyles(): string {
    return `
        <style>
            .conversation-container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }

            .message-bubble {
                margin: 16px 0;
                padding: 16px 20px;
                border-radius: 20px;
                max-width: 80%;
            }

            .message-bubble.left {
                background: #e2e8f0;
                margin-right: auto;
                border-bottom-left-radius: 4px;
            }

            .message-bubble.right {
                background: #3b82f6;
                color: white;
                margin-left: auto;
                border-bottom-right-radius: 4px;
            }

            .audio-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 20px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .audio-btn:hover {
                opacity: 1;
            }

            .translation-toggle {
                font-size: 12px;
                color: #64748b;
                margin-top: 8px;
                cursor: pointer;
            }

            .translation-text {
                font-size: 14px;
                color: #94a3b8;
                font-style: italic;
                margin-top: 8px;
            }
        </style>
    `;
}

/**
 * Get timeline specific styles
 */
function getTimelineStyles(): string {
    return `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Merriweather:wght@300;400;700&display=swap');

            body {
                background-color: #f8fafc;
                background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
                background-size: 20px 20px;
            }

            .timeline-container {
                width: 100%;
                height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 40px 40px 140px 40px; /* Added bottom padding for nav */
                position: relative;
                overflow: hidden;
            }

            /* ... (existing styles) ... */

            /* Timeline Navigation Footer */
            .timeline-nav-container {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 100px;
                background: white;
                border-top: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 40px;
                z-index: 20;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
            }

            .timeline-track {
                position: absolute;
                top: 50%;
                left: 40px;
                right: 40px;
                height: 2px;
                background: #e2e8f0;
                transform: translateY(-50%);
                z-index: 1;
            }

            .timeline-nav-items {
                width: 100%;
                max-width: 1000px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                z-index: 2;
            }

            .nav-item {
                display: flex;
                flex-direction: column;
                cursor: pointer;
                transition: all 0.2s ease;
                background: white;
                padding: 8px 16px;
                border-radius: 50px;
                border: 1px solid #e2e8f0;
                min-width: 180px;
            }

            .nav-item:hover {
                border-color: #3b82f6;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
            }

            .nav-item.prev {
                align-items: flex-start;
                padding-left: 20px;
            }

            .nav-item.next {
                align-items: flex-end;
                text-align: right;
                padding-right: 20px;
            }

            .nav-item.disabled {
                opacity: 0;
                pointer-events: none;
            }

            .nav-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #94a3b8;
                font-weight: 700;
                margin-bottom: 2px;
            }

            .nav-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .nav-title {
                font-family: 'Playfair Display', serif;
                font-size: 14px;
                font-weight: 700;
                color: #334155;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 140px;
            }

            .nav-year {
                font-family: 'Fira Code', monospace;
                font-size: 11px;
                color: #64748b;
                background: #f1f5f9;
                padding: 2px 6px;
                border-radius: 4px;
            }

            /* Current Indicator in Nav */
            .nav-current-indicator {
                width: 12px;
                height: 12px;
                background: #3b82f6;
                border: 3px solid white;
                box-shadow: 0 0 0 2px #3b82f6;
                border-radius: 50%;
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                z-index: 3;
            }

            .timeline-card-wrapper {
                position: relative;
                width: 100%;
                max-width: 1000px;
                display: flex;
                flex-direction: column; /* Mobile first */
                background: white;
                border-radius: 24px;
                box-shadow:
                    0 10px 15px -3px rgba(0, 0, 0, 0.1),
                    0 4px 6px -2px rgba(0, 0, 0, 0.05),
                    0 20px 25px -5px rgba(0, 0, 0, 0.1);
                overflow: hidden;
                animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @media (min-width: 768px) {
                .timeline-card-wrapper.has-image {
                    flex-direction: row;
                    height: 500px;
                }
            }

            /* Image Section */
            .timeline-image-section {
                flex: 1;
                position: relative;
                overflow: hidden;
                min-height: 200px;
            }

            .timeline-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.7s ease;
            }

            .timeline-card-wrapper:hover .timeline-image {
                transform: scale(1.03);
            }

            /* Content Section */
            .timeline-content-section {
                flex: 1;
                padding: 40px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                position: relative;
            }

            .timeline-date-badge {
                display: inline-block;
                background: #0f172a;
                color: #fff;
                padding: 6px 16px;
                border-radius: 50px;
                font-family: 'Fira Code', monospace;
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 24px;
                align-self: flex-start;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }

            .timeline-title {
                font-family: 'Playfair Display', serif;
                font-size: 36px;
                line-height: 1.2;
                color: #1e293b;
                margin-bottom: 16px;
                font-weight: 700;
            }

            .timeline-description {
                font-family: 'Merriweather', serif;
                font-size: 16px;
                line-height: 1.8;
                color: #475569;
                margin-bottom: 24px;
            }

            /* Fun Fact Box */
            .timeline-fact {
                background: #eff6ff;
                border-radius: 12px;
                padding: 16px;
                border-left: 4px solid #3b82f6;
                margin-top: auto;
            }

            .timeline-fact strong {
                display: block;
                color: #1d4ed8;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 4px;
                font-family: 'Inter', sans-serif;
            }

            .timeline-fact p {
                color: #334155;
                font-size: 14px;
                margin: 0;
                line-height: 1.5;
                font-style: italic;
            }

            /* Decorative Elements */
            .timeline-source {
                position: absolute;
                bottom: 12px;
                right: 40px;
                font-size: 10px;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            /* Animations */
            @keyframes slideUpFade {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        </style>
    `;
}

/**
 * Get quiz-specific styles for interactive quizzes
 */
function getQuizStyles(): string {
    return `
        <style>
            /* Quiz Container */
            .quiz-container {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 80px;
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
            }

            .quiz-question-wrapper {
                max-width: 1200px;
                width: 100%;
                text-align: center;
            }

            /* Question Number Badge */
            .quiz-question-number {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                color: white;
                padding: 8px 24px;
                border-radius: 20px;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 24px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
            }

            /* Question Text */
            .quiz-question-text {
                font-family: 'Montserrat', sans-serif;
                font-size: 42px;
                font-weight: 700;
                line-height: 1.3;
                color: #0f172a;
                margin-bottom: 48px;
            }

            /* Options Container */
            .quiz-options {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                max-width: 1000px;
                margin: 0 auto;
            }

            .quiz-options.single-column {
                grid-template-columns: 1fr;
                max-width: 700px;
            }

            /* Individual Option */
            .quiz-option {
                display: flex;
                align-items: center;
                padding: 20px 28px;
                background: #f8fafc;
                border: 3px solid #e2e8f0;
                border-radius: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: left;
            }

            .quiz-option:hover {
                border-color: #3b82f6;
                background: #eff6ff;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
            }

            .quiz-option.selected {
                border-color: #3b82f6;
                background: #eff6ff;
            }

            .quiz-option.correct {
                border-color: #22c55e;
                background: #f0fdf4;
            }

            .quiz-option.correct .quiz-option-letter {
                background: #22c55e;
                border-color: #22c55e;
            }

            .quiz-option.incorrect {
                border-color: #ef4444;
                background: #fef2f2;
            }

            .quiz-option.incorrect .quiz-option-letter {
                background: #ef4444;
                border-color: #ef4444;
            }

            .quiz-option.disabled {
                pointer-events: none;
                opacity: 0.7;
            }

            /* Option Letter (A, B, C, D) */
            .quiz-option-letter {
                width: 44px;
                height: 44px;
                min-width: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: white;
                border: 2px solid #cbd5e1;
                border-radius: 12px;
                font-family: 'Montserrat', sans-serif;
                font-size: 18px;
                font-weight: 700;
                color: #475569;
                margin-right: 16px;
                transition: all 0.2s ease;
            }

            .quiz-option:hover .quiz-option-letter,
            .quiz-option.selected .quiz-option-letter {
                background: #3b82f6;
                border-color: #3b82f6;
                color: white;
            }

            /* Option Text */
            .quiz-option-text {
                font-size: 20px;
                color: #1e293b;
                font-weight: 500;
                flex: 1;
            }

            /* Check Icon for correct/incorrect */
            .quiz-option-icon {
                width: 32px;
                height: 32px;
                margin-left: 12px;
                display: none;
            }

            .quiz-option.correct .quiz-option-icon.correct-icon,
            .quiz-option.incorrect .quiz-option-icon.incorrect-icon {
                display: block;
            }

            /* Submit/Check Button */
            .quiz-submit-btn {
                margin-top: 40px;
                padding: 16px 48px;
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
            }

            .quiz-submit-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
            }

            .quiz-submit-btn:disabled {
                background: #94a3b8;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            /* Feedback Container */
            .quiz-feedback {
                margin-top: 32px;
                padding: 24px 32px;
                border-radius: 16px;
                max-width: 800px;
                margin-left: auto;
                margin-right: auto;
                display: none;
            }

            .quiz-feedback.show {
                display: block;
                animation: slideUp 0.3s ease;
            }

            .quiz-feedback.correct {
                background: linear-gradient(135deg, #f0fdf4, #dcfce7);
                border: 2px solid #22c55e;
            }

            .quiz-feedback.incorrect {
                background: linear-gradient(135deg, #fef2f2, #fee2e2);
                border: 2px solid #ef4444;
            }

            .quiz-feedback-title {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 8px;
            }

            .quiz-feedback.correct .quiz-feedback-title {
                color: #16a34a;
            }

            .quiz-feedback.incorrect .quiz-feedback-title {
                color: #dc2626;
            }

            .quiz-feedback-text {
                font-size: 18px;
                color: #475569;
                line-height: 1.5;
            }

            /* Progress indicator */
            .quiz-progress {
                position: absolute;
                top: 24px;
                right: 40px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .quiz-progress-text {
                font-size: 14px;
                color: #64748b;
                font-weight: 500;
            }

            .quiz-progress-bar {
                width: 120px;
                height: 6px;
                background: #e2e8f0;
                border-radius: 3px;
                overflow: hidden;
            }

            .quiz-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                border-radius: 3px;
                transition: width 0.3s ease;
            }

            /* Score display */
            .quiz-score {
                position: absolute;
                top: 24px;
                left: 40px;
                background: #f1f5f9;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                color: #475569;
            }

            .quiz-score-correct {
                color: #22c55e;
            }

            /* Animations */
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }

            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .quiz-option.incorrect {
                animation: shake 0.5s ease;
            }

            .quiz-option.correct {
                animation: pulse 0.5s ease;
            }

            /* Timer (optional) */
            .quiz-timer {
                position: absolute;
                top: 24px;
                left: 50%;
                transform: translateX(-50%);
                background: #fef3c7;
                border: 2px solid #f59e0b;
                padding: 8px 20px;
                border-radius: 20px;
                font-size: 16px;
                font-weight: 600;
                color: #92400e;
            }

            .quiz-timer.warning {
                background: #fee2e2;
                border-color: #ef4444;
                color: #dc2626;
                animation: pulse 1s infinite;
            }

            /* True/False specific styling */
            .quiz-options.true-false {
                grid-template-columns: repeat(2, 1fr);
                max-width: 600px;
            }

            .quiz-options.true-false .quiz-option {
                justify-content: center;
            }

            .quiz-options.true-false .quiz-option-letter {
                display: none;
            }

            .quiz-options.true-false .quiz-option-text {
                text-align: center;
                font-size: 24px;
            }

            /* Fill in the blank */
            .quiz-blank-input {
                display: inline-block;
                min-width: 150px;
                border: none;
                border-bottom: 3px solid #3b82f6;
                background: transparent;
                font-size: 24px;
                font-family: 'Inter', sans-serif;
                text-align: center;
                padding: 4px 8px;
                margin: 0 8px;
                outline: none;
            }

            .quiz-blank-input:focus {
                border-bottom-color: #8b5cf6;
            }

            .quiz-blank-input.correct {
                border-bottom-color: #22c55e;
                color: #22c55e;
            }

            .quiz-blank-input.incorrect {
                border-bottom-color: #ef4444;
                color: #ef4444;
            }

            /* Explanation toggle */
            .quiz-explanation-toggle {
                margin-top: 16px;
                color: #3b82f6;
                cursor: pointer;
                font-size: 14px;
                text-decoration: underline;
            }

            .quiz-explanation {
                margin-top: 12px;
                padding: 16px;
                background: #f8fafc;
                border-radius: 8px;
                font-size: 16px;
                color: #475569;
                display: none;
            }

            .quiz-explanation.show {
                display: block;
            }
        </style>
    `;
}

/**
 * Get flashcard specific styles
 */
function getFlashcardStyles(): string {
    return `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;800&family=Space+Grotesk:wght@300;400;600&family=Caveat:wght@700&display=swap');

            body {
                margin: 0;
                padding: 0;
                background-color: #0f172a;
                font-family: 'Outfit', sans-serif;
                overflow: hidden;
            }

            .flashcard-stage {
                width: 100%;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: radial-gradient(circle at 50% 10%, #1e293b 0%, #020617 100%);
                perspective: 2500px;
                position: relative;
                overflow: hidden;
            }

            /* Ambient Background Elements */
            .ambient-glow {
                position: absolute;
                border-radius: 50%;
                filter: blur(100px);
                opacity: 0.15;
                z-index: 0;
                animation: pulseGlow 10s ease-in-out infinite alternate;
            }
            .glow-1 { top: -20%; left: -10%; width: 800px; height: 800px; background: #8b5cf6; }
            .glow-2 { bottom: -20%; right: -10%; width: 900px; height: 900px; background: #3b82f6; animation-delay: -5s; }

            @keyframes pulseGlow {
                0% { transform: scale(1); opacity: 0.15; }
                100% { transform: scale(1.1); opacity: 0.25; }
            }

            /* Card Container */
            .flashcard-container {
                position: relative;
                width: 800px;
                height: 520px;
                max-width: 90vw;
                max-height: 70vh;
                z-index: 10;
                transform-style: preserve-3d;
                transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
                cursor: pointer;
            }

            .flashcard-container:hover {
                transform: translateY(-10px) rotateX(2deg);
            }

            .flashcard-container.flipped {
                transform: rotateY(180deg);
            }

            .flashcard-container.flipped:hover {
                transform: rotateY(180deg) translateY(-10px) rotateX(2deg);
            }

            /* Glassmorphism Card Faces */
            .card-face {
                position: absolute;
                width: 100%;
                height: 100%;
                -webkit-backface-visibility: hidden;
                backface-visibility: hidden;
                border-radius: 32px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px;
                box-sizing: border-box;
                text-align: center;
                box-shadow:
                    0 25px 50px -12px rgba(0, 0, 0, 0.6),
                    0 0 0 1px rgba(255, 255, 255, 0.1);
            }

            /* Front Face */
            .card-front {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            /* Back Face */
            .card-back {
                background: linear-gradient(135deg, #f8fafc, #f1f5f9);
                transform: rotateY(180deg);
                border: 1px solid white;
                color: #1e293b;
            }

            /* Decorative Lines */
            .deco-line {
                width: 60px;
                height: 6px;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                border-radius: 3px;
                margin-bottom: 30px;
            }

            /* Typography */
            .label-badge {
                font-family: 'Space Grotesk', sans-serif;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.2em;
                font-weight: 600;
                margin-bottom: 24px;
                padding: 8px 16px;
                border-radius: 100px;
            }

            .card-front .label-badge {
                background: rgba(255, 255, 255, 0.1);
                color: #e2e8f0;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .card-back .label-badge {
                background: #e2e8f0;
                color: #64748b;
            }

            .card-content {
                font-family: 'Outfit', sans-serif;
                font-weight: 700;
                line-height: 1.25;
                margin: 0;
            }

            .card-front .card-content {
                font-size: 48px;
                color: white;
                text-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .card-back .card-content {
                font-size: 36px;
                color: #1e293b;
                font-weight: 500;
                line-height: 1.6;
            }

            /* Hint/Instruction */
            .tap-instruction {
                position: absolute;
                bottom: 36px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: 'Space Grotesk', sans-serif;
                font-size: 14px;
                font-weight: 500;
                opacity: 0.6;
                transition: opacity 0.3s;
            }

            .card-container:hover .tap-instruction { opacity: 1; }

            .card-front .tap-instruction { color: #cbd5e1; }
            .card-back .tap-instruction { color: #94a3b8; }

            .instruction-key {
                border: 1px solid currentColor;
                border-radius: 6px;
                padding: 2px 8px;
                font-size: 11px;
                font-weight: 700;
            }

            /* Progress Bar */
            .progress-container {
                position: absolute;
                top: 40px;
                right: 40px;
                z-index: 20;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }

            .progress-text {
                font-family: 'Space Grotesk', sans-serif;
                font-size: 16px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.8);
                margin-bottom: 8px;
            }

            .progress-bar {
                width: 150px;
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                border-radius: 3px;
                transition: width 0.5s ease;
            }

            /* Responsive */
            @media (max-width: 900px) {
                .flashcard-container { width: 90%; height: 60vh; }
                .card-front .card-content { font-size: 32px; }
                .card-back .card-content { font-size: 24px; }
            }
        </style>
    `;
}

/**
 * Get storybook specific styles for visual storytelling
 */
function getStorybookStyles(): string {
    return `
        <style>
            /* Reset & Base for Storybook */
            body {
                background-color: #fdfaf5; /* Warm paper color */
                color: #2c1810;
                display: flex;
                flex-direction: column;
                margin: 0;
                padding: 0;
                height: 100vh;
                overflow: hidden;
                font-family: 'Georgia', 'Times New Roman', serif;
            }

            /* Main Page Container */
            .storybook-page {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                padding: 40px;
                box-sizing: border-box;
                position: relative;
                /* Subtle paper texture effect */
                background-image:
                    linear-gradient(to right, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 5%, rgba(0,0,0,0) 95%, rgba(0,0,0,0.02) 100%);
            }

            /* Cover Page Special Styling */
            .storybook-page.cover-page {
                justify-content: center;
                align-items: center;
                background: radial-gradient(circle at center, #fff 0%, #fdfaf5 100%);
                text-align: center;
            }

            .storybook-page.cover-page .illustration-container {
                max-height: 50vh;
                margin-bottom: 40px;
            }

            .storybook-page.cover-page .text-container {
                margin-top: 0;
                border: 4px double #8b4513;
                padding: 2rem 4rem;
                background: white;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                max-width: 80%;
            }

            .storybook-page.cover-page .story-text {
                font-family: 'Montserrat', sans-serif;
                font-size: 3.5rem;
                font-weight: 800;
                color: #8b4513;
                text-transform: uppercase;
                letter-spacing: 2px;
                text-shadow: 2px 2px 0px rgba(139, 69, 19, 0.1);
                margin: 0;
            }

            /* Illustration Layout */
            .illustration-container {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 2rem;
                overflow: hidden;
                position: relative;
                min-height: 0; /* Important for flex child overflow */
                width: 100%;
            }

            /* Frame effect for images */
            .page-illustration {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                transition: transform 0.3s ease;
                border: 8px solid white;
            }

            .page-illustration:hover {
                transform: scale(1.01);
            }

            /* Text Layout */
            .text-container {
                background: rgba(255, 255, 255, 0.9);
                padding: 1.5rem 2.5rem;
                border-radius: 16px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                margin: 0 auto;
                width: 100%;
                max-width: 900px;
                backdrop-filter: blur(5px);
                border: 1px solid rgba(139, 69, 19, 0.1);
                transition: transform 0.3s ease;
            }

            .text-bottom {
                margin-top: auto;
            }

            .text-center {
                text-align: center;
            }

            .text-top {
                margin-bottom: auto;
            }

            .story-text {
                font-family: 'Georgia', 'Crimson Text', serif;
                font-size: 1.75rem;
                line-height: 1.6;
                color: #4a3b32;
                margin: 0;
            }

            /* Page Number */
            .page-number {
                position: absolute;
                bottom: 20px;
                right: 30px;
                font-family: 'Courier New', monospace;
                font-size: 1.2rem;
                color: #8b4513;
                font-weight: bold;
                opacity: 0.6;
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .storybook-page { padding: 20px; }
                .story-text { font-size: 1.25rem; }
                .storybook-page.cover-page .story-text { font-size: 2rem; padding: 1rem; }
            }

            /* Animations */
            .storybook-page > * {
                animation: fadeIn 0.8s ease-out forwards;
            }

            .illustration-container {
                animation-delay: 0.1s;
                opacity: 0;
            }

            .text-container {
                animation-delay: 0.4s;
                opacity: 0;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    `;
}

/**
 * Get helper scripts for interactivity
 */
function getHelperScripts(): string {
    return `
        <script>
            // Re-render Math using KaTeX
            window.renderMath = function(selector) {
                if (window.renderMathInElement && window.katex) {
                    const el = selector ? (typeof selector === 'string' ? document.querySelector(selector) : selector) : document.body;
                    if(el) {
                        try {
                            renderMathInElement(el, {
                                delimiters: [
                                    {left: '$$', right: '$$', display: true},
                                    {left: '$', right: '$', display: false},
                                    {left: '\\\\(', right: '\\\\)', display: false},
                                    {left: '\\\\[', right: '\\\\]', display: true}
                                ],
                                throwOnError: false
                            });
                        } catch (e) {
                            console.warn('KaTeX render error:', e);
                        }
                    }
                }
            };

            // Highlight Code using Prism
            window.highlightCode = function() {
                if (window.Prism) {
                    Prism.highlightAll();
                }
            };

            // SVG drawing animation
            window.animateSVG = function(svgId, duration, callback) {
                if (window.Vivus) {
                    var cb = typeof callback === 'function' ? callback : undefined;
                    try {
                        let target = svgId;
                        if (typeof svgId === 'string' && !svgId.startsWith('#') && !document.getElementById(svgId)) {
                            new Vivus(svgId, {
                                duration: duration || 100,
                                type: 'oneByOne',
                                animTimingFunction: Vivus.EASE_OUT
                            }, cb);
                        } else {
                            new Vivus(svgId, {
                                duration: duration || 100,
                                type: 'oneByOne',
                                animTimingFunction: Vivus.EASE_OUT
                            }, cb);
                        }
                    } catch(e) { console.warn('Vivus init error', e); }
                }
            };

            // Hand-drawn annotation
            window.annotate = function(selectorOrEl, options) {
                if (window.RoughNotation) {
                    try {
                        const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                        if (el) {
                            // Ensure backward compatibility if options is just a string (type)
                            const opts = typeof options === 'object' ? options : {
                                type: options || 'underline',
                                color: arguments[2] || 'red',
                                padding: arguments[3] || 5
                            };

                            const annotation = RoughNotation.annotate(el, {
                                type: opts.type || 'underline',
                                color: opts.color || '#dc2626',
                                strokeWidth: opts.strokeWidth || 3,
                                padding: opts.padding || 5,
                                animationDuration: opts.duration || 800
                            });
                            annotation.show();
                            return annotation;
                        }
                    } catch (e) { console.warn('annotate error', e); }
                }
                return null;
            };

            // Simple fade in
            window.fadeIn = function(selector, duration, delay) {
                try {
                    gsap.fromTo(selector,
                        {opacity: 0},
                        {opacity: 1, duration: duration || 0.5, delay: delay || 0, ease: 'power2.out'}
                    );
                } catch (e) { console.warn('fadeIn error', e); }
            };

            // Typewriter effect
            window.typewriter = function(selectorOrEl, duration, delay) {
                const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                if (!el) return;
                const text = el.textContent;
                el.textContent = '';
                el.style.opacity = '1';
                let i = 0;
                const speed = (duration || 1) * 1000 / Math.max(1, text.length);
                setTimeout(() => {
                    const interval = setInterval(() => {
                        if (i < text.length) {
                            el.textContent += text.charAt(i);
                            i++;
                        } else {
                            clearInterval(interval);
                        }
                    }, speed);
                }, (delay || 0) * 1000);
            };

            // Pop in with scale
            window.popIn = function(selector, duration, delay) {
                try {
                    gsap.fromTo(selector,
                        {opacity: 0, scale: 0.85},
                        {opacity: 1, scale: 1, duration: duration || 0.4, delay: delay || 0, ease: 'back.out(1.7)'}
                    );
                } catch (e) { console.warn('popIn error', e); }
            };

            // Slide up from below
            window.slideUp = function(selector, duration, delay) {
                try {
                    gsap.fromTo(selector,
                        {opacity: 0, y: 30},
                        {opacity: 1, y: 0, duration: duration || 0.5, delay: delay || 0, ease: 'power2.out'}
                    );
                } catch (e) { console.warn('slideUp error', e); }
            };

            // Reveal lines with stagger
            window.revealLines = function(selectorOrEl, staggerDelay) {
                const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                if (!el) return;
                const lines = el.querySelectorAll('.line');
                if (lines.length === 0) {
                    window.fadeIn(el, 0.5);
                    return;
                }
                try {
                    gsap.fromTo(lines,
                        {opacity: 0, y: 20},
                        {opacity: 1, y: 0, duration: 0.4, stagger: staggerDelay || 0.3, ease: 'power2.out'}
                    );
                } catch (e) { console.warn('revealLines err', e); }
            };

            // Show text then annotate
            window.showThenAnnotate = function(textSelector, termSelector, annotationType, annotationColor, textDelay, annotationDelay) {
                window.fadeIn(textSelector, 0.5, textDelay || 0);
                setTimeout(() => {
                    window.annotate(termSelector, {
                        type: annotationType || 'underline',
                        color: annotationColor || '#dc2626',
                        duration: 600
                    });
                }, ((textDelay || 0) + (annotationDelay || 0.8)) * 1000);
            };

            window.sounds = {
                pop: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
                click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
                whoosh: 'https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3',
                success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'
            };

            window.playSound = function(soundName) {
                if (window.sounds && window.sounds[soundName]) {
                    const audio = new Audio(window.sounds[soundName]);
                    audio.volume = 0.5;
                    audio.play().catch(e => console.log('Sound play failed:', e));
                }
            };

            // Render Mermaid
            window.renderMermaid = function(selector) {
                if (window.mermaid) {
                    try {
                        mermaid.init(undefined, selector ? document.querySelectorAll(selector) : document.querySelectorAll('.mermaid'));
                    } catch (e) {
                        console.error('Mermaid render error:', e);
                    }
                }
            };

            // Initialize on load
            window.addEventListener('load', () => {
                if(window.gsap && window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);

                if (window.RoughNotation && !window.RoughNotation.annotateAll) {
                    window.RoughNotation.annotateAll = function(annotations) {
                        if (Array.isArray(annotations) && window.RoughNotation.annotationGroup) {
                                const group = window.RoughNotation.annotationGroup(annotations);
                                group.show();
                        } else if (Array.isArray(annotations)) {
                                annotations.forEach(a => a.show && a.show());
                        }
                    };
                }

                if(window.mermaid) window.renderMermaid();
                if(window.renderMathInElement && window.katex) window.renderMath();
                if(window.Prism) window.highlightCode();
            });

            // Fallback: Force all elements visible after a delay (in case GSAP fails to load)
            setTimeout(function() {
                document.querySelectorAll('[style*="opacity"]').forEach(function(el) {
                    el.style.opacity = '1';
                });
                document.querySelectorAll('[style*="visibility"]').forEach(function(el) {
                    el.style.visibility = 'visible';
                });
            }, 500);
        </script>
    `;
}

/**
 * Get quiz specific interaction scripts
 */
function getQuizScripts(): string {
    return `
        <script>
            // Global handler for quiz options
            window.handleOptionClick = function(element, answer, isCorrect, explanation) {
                // 1. Prevent multiple clicks if already answered
                const container = element.closest('.quiz-container');
                if (container.classList.contains('answered')) return;

                // 2. Mark container as answered to lock interaction
                container.classList.add('answered');

                // 3. Visual Feedback
                // Remove selected from siblings
                const options = container.querySelectorAll('.quiz-option');
                options.forEach(opt => opt.classList.remove('selected'));

                // Add selected/correct/incorrect to clicked element
                element.classList.add('selected');

                if (isCorrect) {
                  element.classList.add('correct');
                  // Trigger confetti if available
                  if (window.confetti) {
                      window.confetti({
                          particleCount: 100,
                          spread: 70,
                          origin: { y: 0.6 }
                      });
                  }
                } else {
                  element.classList.add('incorrect');

                  // Highlight the correct answer if it exists
                  const correctOption = container.querySelector('.quiz-option[data-correct="true"]');
                  if (correctOption) {
                      correctOption.classList.add('correct');
                  }
                }

                // 4. Show Feedback if available
                const feedback = container.querySelector('.quiz-feedback');
                if (feedback) {
                    feedback.classList.add('show');
                    feedback.classList.add(isCorrect ? 'correct' : 'incorrect');

                    // You can populate text dynamicallly here if needed
                }

                // 5. Notify Parent Player
                window.parent.postMessage({
                  type: 'QUIZ_ANSWER_SELECTED',
                  payload: {
                      answer: answer,
                      isCorrect: isCorrect
                  }
                }, '*');

                // 6. Navigation (Optional Auto-advance on correct)
                // Only if interactive script hasn't defined its own logic
                if (isCorrect) {
                  setTimeout(() => {
                    window.parent.postMessage({ type: 'NAVIGATE_NEXT' }, '*');
                  }, 2000);
                }
            };
        </script>
    `;
}

/**
 * Generate rich HTML for a timeline event based on metadata
 */
export function generateTimelineHtml(entry: Entry, index: number, entries: Entry[] = []): string {
    const meta = entry.entry_meta || {};
    const hasImage = !!meta.image_url;

    // Get context for navigation
    const prevEntry = index > 0 ? entries[index - 1] : null;
    const nextEntry = index < entries.length - 1 ? entries[index + 1] : null;

    return `
        <div class="timeline-container">
            <div class="timeline-card-wrapper ${hasImage ? 'has-image' : ''}">
                ${
                    hasImage
                        ? `
                    <div class="timeline-image-section">
                        <img src="${meta.image_url}" alt="${meta.title}" class="timeline-image">
                    </div>
                `
                        : ''
                }

                <div class="timeline-content-section">
                    <div class="timeline-date-badge">
                        ${meta.date || meta.date_display || `Event ${index + 1}`}
                    </div>

                    <h1 class="timeline-title">${meta.title}</h1>

                    ${
                        meta.description
                            ? `
                        <div class="timeline-description">
                            ${meta.description}
                        </div>
                    `
                            : ''
                    }

                    ${
                        meta.fun_fact
                            ? `
                        <div class="timeline-fact">
                            <strong>Did You Know?</strong>
                            <p>${meta.fun_fact}</p>
                        </div>
                    `
                            : ''
                    }

                    ${
                        meta.source
                            ? `
                        <div class="timeline-source">
                            Source: ${meta.source}
                        </div>
                    `
                            : ''
                    }
                </div>
            </div>

            <!-- Timeline Navigation Footer -->
            <div class="timeline-nav-container">
                <div class="timeline-track"></div>
                <div class="timeline-nav-items">
                    <!-- Prev Item -->
                    <div class="nav-item prev ${!prevEntry ? 'disabled' : ''}"
                         onclick="${prevEntry ? "window.parent.postMessage({ type: 'NAVIGATE_PREV' }, '*')" : ''}">
                         ${
                             prevEntry
                                 ? `
                            <div class="nav-label">Previous</div>
                            <div class="nav-content">
                                <div class="nav-date-box">
                                    <div class="nav-title">${prevEntry.entry_meta?.title || `Event ${index}`}</div>
                                    <div class="nav-year">${prevEntry.entry_meta?.date || prevEntry.entry_meta?.date_display || '...'}</div>
                                </div>
                            </div>
                         `
                                 : ''
                         }
                    </div>

                    <!-- Current Indicator -->
                    <div class="nav-current-indicator"></div>

                    <!-- Next Item -->
                    <div class="nav-item next ${!nextEntry ? 'disabled' : ''}"
                         onclick="${nextEntry ? "window.parent.postMessage({ type: 'NAVIGATE_NEXT' }, '*')" : ''}">
                         ${
                             nextEntry
                                 ? `
                            <div class="nav-label">Next</div>
                            <div class="nav-content">
                                <div class="nav-date-box" style="align-items: flex-end; display: flex; flex-direction: column;">
                                    <div class="nav-title">${nextEntry.entry_meta?.title || `Event ${index + 2}`}</div>
                                    <div class="nav-year">${nextEntry.entry_meta?.date || nextEntry.entry_meta?.date_display || '...'}</div>
                                </div>
                            </div>
                         `
                                 : ''
                         }
                    </div>
                </div>
            </div>

            <!-- Progress Context -->
            <div style="position: absolute; bottom: 120px; font-family: 'Fira Code', monospace; color: #94a3b8; font-size: 12px; width: 100%; text-align: center;">
                 Event ${index + 1} of ${entries.length || '--'}
            </div>
        </div>

        <script>
            // Set scale animation for entry
            setTimeout(() => {
                const card = document.querySelector('.timeline-card-wrapper');
                if(card) {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }
            }, 100);
        </script>
    `;
}

/**
 * Generate rich HTML for a Flashcard based on metadata
 */
export function generateFlashcardHtml(entry: Entry, index: number, entries: Entry[] = []): string {
    const rawEntry = entry as any;
    const meta = entry.entry_meta || {};

    let title =
        meta.title ||
        meta.question ||
        meta.front ||
        rawEntry.title ||
        rawEntry.question ||
        rawEntry.front;
    let description =
        meta.description ||
        meta.text ||
        meta.answer ||
        meta.back ||
        rawEntry.description ||
        rawEntry.text ||
        rawEntry.answer ||
        rawEntry.back ||
        rawEntry.content;
    const imageUrl = meta.image_url || rawEntry.image_url;

    // Advanced Fallback: Parse entry.html if explicit data is missing
    if ((!title || !description) && entry.html && !entry.html.includes('flashcard-stage')) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(entry.html, 'text/html');

            // Try to find common structural patterns
            // 1. Look for explicit .front/.back or .question/.answer classes
            const frontEl = doc.querySelector('.front, .question, .term');
            const backEl = doc.querySelector('.back, .answer, .definition');

            if (frontEl) title = frontEl.textContent?.trim();
            if (backEl) description = backEl.innerHTML; // Keep HTML formatting for answer

            // 2. If no explicit classes, assume first meaningful block is question, rest is answer
            if (!title || !description) {
                let blocks = Array.from(doc.body.children).filter(
                    (el) =>
                        el.tagName !== 'SCRIPT' &&
                        el.tagName !== 'STYLE' &&
                        el.textContent?.trim().length! > 0
                );

                // Auto-unwrap if there is a single container div (common in some editors)
                const firstBlock = blocks[0];
                if (blocks.length === 1 && firstBlock && firstBlock.children.length > 0) {
                    blocks = Array.from(firstBlock.children).filter(
                        (el) =>
                            el.tagName !== 'SCRIPT' &&
                            el.tagName !== 'STYLE' &&
                            el.textContent?.trim().length! > 0
                    );
                }

                if (blocks.length >= 2) {
                    if (!title) title = blocks[0]?.textContent?.trim();
                    if (!description)
                        description = blocks
                            .slice(1)
                            .map((el) => el.outerHTML)
                            .join('');
                } else if (blocks.length === 1 && blocks[0]) {
                    // Only one block found. Is it split by a newline or question mark?
                    const text = blocks[0].textContent?.trim() || '';
                    if (!title) {
                        // Heuristic: If it contains a '?' and looks like a question, treat the rest as answer?
                        // Or just treat it as title.
                        if (text.includes('?') && text.length > 10) {
                            const parts = text.split('?');
                            title = parts[0] + '?';
                            if (parts[1] && parts[1].trim().length > 0) {
                                description = parts.slice(1).join('?').trim();
                            }
                        } else {
                            title = text;
                        }
                    }
                } else {
                    // Just raw text?
                    const text = doc.body.textContent?.trim();
                    if (text && !title) title = text;
                }
            }
        } catch (e) {
            console.warn('Error parsing flashcard HTML', e);
        }
    }

    // Filter out generic labels if they were accidentally captured
    if (title && (title.toLowerCase() === 'question' || title.toLowerCase() === 'term')) {
        title = '';
    }

    // Final Defaults
    if (!title) title = `Question ${index + 1}`;
    if (!description || description === 'Answer key not found.') {
        // Last ditch effort prevent error message if we have a title but no description
        // We might be showing a "Term" card where the definition will appear on click?
        // No, the UI flips to back for definition.
        if (title && title.length > 0 && (!description || description.trim() === '')) {
            description = 'No definition available.';
        } else if (!description) {
            description = 'Answer key not found.';
        }
    }

    const progress = Math.round(((index + 1) / entries.length) * 100);

    return `
        <div class="flashcard-stage">
            <div class="ambient-glow glow-1"></div>
            <div class="ambient-glow glow-2"></div>

            <div class="progress-container">
                <div class="progress-text">${index + 1} / ${entries.length}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>

            <div class="flashcard-container" onclick="this.classList.toggle('flipped')">
                <!-- Front (Question/Term) -->
                <div class="card-face card-front">
                    <div class="label-badge">Question</div>
                    <div class="deco-line"></div>
                    <h2 class="card-content">
                        ${title}
                    </h2>

                    <div class="tap-instruction">
                        <span class="instruction-key">SPACE</span>
                        <span>to flip</span>
                    </div>
                </div>

                <!-- Back (Answer/Definition) -->
                <div class="card-face card-back">
                    <div class="label-badge">Answer</div>
                    <div class="card-content">
                        ${description}
                    </div>
                     ${
                         imageUrl
                             ? `
                        <div style="margin-top: 30px; max-height: 200px; overflow: hidden; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    `
                             : ''
                     }

                    <div class="tap-instruction">
                        <span class="instruction-key">SPACE</span>
                        <span>to flip back</span>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // Ensure card is visible immediately
            const stage = document.querySelector('.flashcard-container');
            if(stage) {
                stage.style.opacity = '1';

                // Animation
                if(window.gsap) {
                   gsap.from('.flashcard-container', {
                        y: 50,
                        opacity: 0,
                        duration: 1,
                        ease: 'power3.out',
                        clearProps: 'opacity'
                    });
                }
            }
        </script>

            // Add keyboard support (Space to flip)
            document.addEventListener('keydown', (e) => {
                if(e.code === 'Space') {
                    const card = document.querySelector('.flashcard-container');
                    if(card) card.classList.toggle('flipped');
                }
            });
        </script>
    `;
}

/**
 * Generate rich HTML for a Storybook page based on metadata
 */
export function generateStorybookHtml(entry: Entry, index: number, entries: Entry[] = []): string {
    const meta = entry.entry_meta || {};
    const entryAny = entry as any;

    // Data extraction with fallbacks
    const title = meta.title || entryAny.title || `Page ${index}`;
    const text =
        meta.text ||
        meta.description ||
        meta.content ||
        meta.story_text ||
        meta.audio_text ||
        entryAny.text ||
        `...`;
    const imageUrl = meta.image_url || entryAny.image_url;
    const pageNumber = index + 1;
    const isCover = index === 0;

    // Layout variation
    const layoutClass = meta.layout || (isCover ? 'cover-page' : 'standard-page');

    // Ensure image is wrapped properly
    const imageHtml = imageUrl
        ? `<div class="illustration-container">
             <img src="${imageUrl}" class="page-illustration" alt="${title}" loading="lazy" />
           </div>`
        : '';

    if (isCover) {
        return `
            <div class="storybook-page cover-page">
                ${imageHtml}
                <div class="text-container">
                    <h1 class="story-text">${title}</h1>
                    ${meta.author ? `<p style="margin-top:20px; font-style:italic; color:#666;">By ${meta.author}</p>` : ''}
                </div>
            </div>
        `;
    }

    return `
        <div class="storybook-page ${layoutClass}">
            ${imageHtml}
            <div class="text-container text-bottom">
                <p class="story-text">${text}</p>
            </div>
            <div class="page-number">${pageNumber}</div>
        </div>
    `;
}

/**
 * Generate rich HTML for a Quiz based on metadata
 */
export function generateQuizHtml(entry: Entry, index: number, entries: Entry[] = []): string {
    const meta = entry.entry_meta || {};
    const entryAny = entry as any;

    const question = meta.question || meta.title || entryAny.question || `Question ${index + 1}`;
    // Options can be an array of strings or objects { text, isCorrect, explanation }
    const rawOptions = meta.options || entryAny.options || [];
    const correctAnswer = meta.correct_answer || entryAny.correct_answer; // Index or text
    const explanation = meta.explanation || entryAny.explanation || '';

    // Normalize options
    const options = rawOptions.map((opt: any, i: number) => {
        const text = typeof opt === 'string' ? opt : opt.text || opt.label;
        const isCorrect =
            typeof opt === 'object' && opt.isCorrect !== undefined
                ? opt.isCorrect
                : text === correctAnswer || i === correctAnswer;
        const optExplanation =
            typeof opt === 'object' ? opt.explanation || explanation : explanation;

        return { text, isCorrect, explanation: optExplanation };
    });

    // If no options found, try to parse from HTML? (Advanced fallback logic omitted for brevity)
    if (options.length === 0) {
        return `<div class="quiz-container"><div class="quiz-question-text">Error: No options data found.</div></div>`;
    }

    const optionsHtml = options
        .map(
            (opt: any, i: number) => `
        <div class="quiz-option" onclick="window.handleOptionClick(this, '${opt.text.replace(/'/g, "\\'")}', ${opt.isCorrect}, '${opt.explanation.replace(/'/g, "\\'")}')" data-correct="${opt.isCorrect}">
            <div class="option-marker">${String.fromCharCode(65 + i)}</div>
            <div class="option-text">${opt.text}</div>
            <div class="feedback-icon correct">✓</div>
            <div class="feedback-icon incorrect">✕</div>
        </div>
    `
        )
        .join('');

    return `
        <div class="quiz-container">
            <div class="quiz-question-wrapper">
                <div class="quiz-question-number">Question ${index + 1}</div>
                <h2 class="quiz-question-text">${question}</h2>
            </div>

            <div class="quiz-options ${options.length > 2 ? '' : 'single-column'}">
                ${optionsHtml}
            </div>

            <div class="quiz-feedback">
                <div class="feedback-title"></div>
                <div class="feedback-text">${explanation}</div>
                <button class="next-btn" onclick="window.parent.postMessage({ type: 'NAVIGATE_NEXT' }, '*')">Continue</button>
            </div>
        </div>
    `;
}

/**
 * Generate rich HTML for a Conversation frame
 */
export function generateConversationHtml(
    entry: Entry,
    index: number,
    entries: Entry[] = []
): string {
    const meta = entry.entry_meta || {};
    const entryAny = entry as any;

    // Supports one or multiple messages in a single frame
    const messages = meta.messages || entryAny.messages || [];

    // If simple single message structure
    if (messages.length === 0 && (meta.text || entryAny.text)) {
        messages.push({
            role: meta.role || entryAny.role || 'system',
            text: meta.text || entryAny.text,
            translation: meta.translation || entryAny.translation,
        });
    }

    const bubblesHtml = messages
        .map((msg: any) => {
            const isLeft =
                msg.role === 'user' ||
                msg.position === 'left' ||
                msg.role === 'student' ||
                msg.role === 'learner';
            // Auto-assign side based on role if not specified
            const sideClass = isLeft ? 'left' : 'right';
            const label = msg.label || msg.role || 'Speaker';

            return `
            <div class="message-bubble ${sideClass}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                    <span style="font-weight:600; font-size:12px; opacity:0.8; text-transform:uppercase;">${label}</span>
                    <button class="audio-btn" onclick="window.parent.postMessage({type:'SPEAK', text:'${msg.text.replace(/'/g, "\\'")}'}, '*')">🔊</button>
                </div>
                <div class="message-text">${msg.text}</div>
                ${
                    msg.translation
                        ? `
                    <div class="translation-toggle" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        See Translation
                    </div>
                    <div class="translation-text" style="display:none;">${msg.translation}</div>
                `
                        : ''
                }
            </div>
        `;
        })
        .join('');

    return `
        <div class="conversation-container">
            ${bubblesHtml}
        </div>
    `;
}

/**
 * Process HTML content based on content type
 */
export function processHtmlContent(
    html: string,
    contentType: ContentType = 'VIDEO',
    isOverlay: boolean = false
): string {
    let processedHtml = html;

    // Fix any absolute file paths
    processedHtml = processedHtml.replace(/file:\/\/\/.*\/generated_images\//g, '');

    // Only strip opacity:0 if there's no <script> tag to animate it back
    const hasScript = /<script[\s>]/i.test(processedHtml);
    if (!hasScript) {
        processedHtml = processedHtml.replace(/opacity\s*:\s*0\s*;?/gi, '');
    }

    // Build the complete HTML with appropriate libraries and styles
    const libs = getCommonLibraries();
    let baseStyles = getBaseStyles();

    // For overlay iframes, use transparent background so content below shows through
    const bodyBackground = isOverlay ? 'transparent' : 'var(--background-color)';
    baseStyles = baseStyles.replace('BODY_BACKGROUND_PLACEHOLDER', bodyBackground);

    let helperScripts = getHelperScripts();

    // Add content-type specific styles and scripts
    let contentStyles = '';
    let kenBurnsStyles = '';
    if (contentType === 'VIDEO') {
        kenBurnsStyles = getKenBurnsStyles();
    }
    switch (contentType) {
        case 'WORKSHEET':
            contentStyles = getWorksheetStyles();
            break;
        case 'CODE_PLAYGROUND':
            contentStyles = getCodePlaygroundStyles();
            break;
        case 'CONVERSATION':
            contentStyles = getConversationStyles();
            break;
        case 'TIMELINE':
            contentStyles = getTimelineStyles();
            break;
        case 'QUIZ':
            contentStyles = getQuizStyles();
            // Inject quiz logic scripts
            helperScripts += getQuizScripts();
            break;
        case 'FLASHCARDS':
            contentStyles = getFlashcardStyles();
            break;
        case 'STORYBOOK':
            contentStyles = getStorybookStyles();
            break;
    }

    if (contentType === 'VIDEO') {
        // Find img tags with data-ken-burns attribute and add the CSS class
        processedHtml = processedHtml.replace(
            /(<img[^>]*)\bdata-ken-burns="([\w-]+)"([^>]*>)/gi,
            (match, before, motion, after) => {
                const className = `kb-${motion}`;
                // If tag already has class attr, append; otherwise add
                if (/class="/.test(before)) {
                    return (
                        before.replace(/class="([^"]*)"/, `class="$1 ${className}"`) +
                        `data-ken-burns="${motion}"` +
                        after
                    );
                }
                return `${before} class="${className}" data-ken-burns="${motion}"${after}`;
            }
        );
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${libs}
            ${baseStyles}
            ${helperScripts}
            ${contentStyles}
            ${kenBurnsStyles}
        </head>
        <body>
            ${processedHtml}
        </body>
        </html>
    `;
}

/**
 * Legacy function for backward compatibility
 */
export function fixHtmlContent(html: string): string {
    return processHtmlContent(html, 'VIDEO');
}
