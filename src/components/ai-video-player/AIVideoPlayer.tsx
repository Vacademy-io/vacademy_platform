import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Rewind, 
  FastForward, 
  Volume2, 
  VolumeX, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import type { 
  ContentType, 
  NavigationType, 
  TimelineMeta, 
  TimelineData, 
  Frame,
} from "./types";
import { CONTENT_TYPE_LABELS, DEFAULT_ENTRY_LABELS } from "./types";
import { getLibraryScriptTags } from "./library-loader";
import { 
  createNavigationController, 
  type NavigationController,
} from "./navigation-controller";

// Re-export types for backward compatibility
export type { Frame, TimelineMeta, TimelineData, ContentType, NavigationType };

export interface AIVideoPlayerProps {
  timelineUrl: string;
  audioUrl?: string;  // Optional: not required for user_driven and self_contained content
  className?: string;
  width?: number;
  height?: number;
  onEntryChange?: (entry: Frame, index: number) => void;
  onContentComplete?: () => void;
}

// Default meta for backward compatibility
const DEFAULT_META: TimelineMeta = {
  content_type: "VIDEO",
  navigation: "time_driven",
  entry_label: "segment",
  audio_start_at: 0,
  total_duration: null,
  dimensions: { width: 1920, height: 1080 },
};

const fixHtmlContent = (html: string, includeLibs = true, contentType: ContentType = "VIDEO") => {
    // Get libraries for the specific content type
    const libsScripts = includeLibs ? getLibraryScriptTags(contentType) : "";
    
    // Inject required libraries + Interaction Script
    const libs = `
        ${libsScripts}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
        <style>
            /* Visual cues for interactive elements */
            .hover-target:hover {
                outline: 2px dashed #3b82f6;
                cursor: grab;
            }
            .is-dragging {
                outline: 2px solid #3b82f6;
                cursor: grabbing;
                user-select: none;
            }
            [contenteditable="true"] {
                outline: 2px solid #22c55e;
                cursor: text;
                min-width: 10px;
            }
            /* Print styles for WORKSHEET content */
            @media print {
                #nav-controls, .no-print { display: none !important; }
                .worksheet-container { max-width: 100%; padding: 0; }
            }
        </style>
        <script>
            window.addEventListener('load', () => {
                // Initialize Libraries
                if(window.gsap && window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);
                if(window.mermaid) mermaid.initialize({startOnLoad:true});

                // --- Interaction Logic ---
                const postUpdate = () => {
                    // Robust serialization to preserve styles (which might move to HEAD) and content
                    let result = "";

                    const isInjection = (node) => {
                        // Check scripts
                        if (node.tagName === 'SCRIPT') {
                            if (node.src && (node.src.includes('gsap') || node.src.includes('mermaid'))) return true;
                            if (node.innerHTML.includes('Interaction Logic')) return true;
                            if (node.innerHTML.includes('gsap.registerPlugin(MotionPathPlugin)')) return true; 
                        }
                        // Check interaction style
                        if (node.tagName === 'STYLE') {
                            if (node.innerHTML.includes('Visual cues for interactive elements')) return true;
                        }
                        return false;
                    }

                    // 1. Process HEAD (Styles often end up here)
                    if (document.head) {
                        Array.from(document.head.childNodes).forEach(node => {
                            if (!isInjection(node)) {
                                result += (node.nodeType === 3 ? node.nodeValue : node.outerHTML) || "";
                            }
                        });
                    }

                    // 2. Process BODY
                    // Clone body to clean up interaction markers on elements (classes/attributes)
                    const bodyClone = document.body.cloneNode(true);
                    
                    // Clean attributes
                    bodyClone.querySelectorAll('*').forEach(el => {
                        el.classList.remove('hover-target', 'is-dragging');
                        el.removeAttribute('contenteditable');
                    });
                    
                    Array.from(bodyClone.childNodes).forEach(node => {
                         if (!isInjection(node)) {
                             result += (node.nodeType === 3 ? node.nodeValue : node.outerHTML) || "";
                         }
                    });

                    window.parent.postMessage({
                        type: 'HTML_UPDATE',
                        html: result 
                    }, '*');
                };

                // Add hover effects to everything reasonable
                document.body.addEventListener('mouseover', (e) => {
                    if (e.target !== document.body && !e.target.classList.contains('hover-target')) {
                        // e.target.classList.add('hover-target');
                    }
                });
                
                // Helper to find a "movable" block (divs, imgs, etc)
                // Helper to find a "movable" block (divs, imgs, etc)
                const getMovable = (target) => {
                    let current = target;
                    while (current && current !== document.body) {
                        const style = window.getComputedStyle(current);
                        if (style.display === 'block' || style.display === 'flex' || current.tagName === 'IMG') {
                            return current;
                        }
                        current = current.parentElement;
                    }
                    return null;
                }

                // Drag Logic
                let draggedEl = null;
                let startX = 0, startY = 0;
                let initialTransform = {x: 0, y: 0};
                let hasMoved = false;

                const getTranslate = (el) => {
                    const style = window.getComputedStyle(el);
                    const matrix = new WebKitCSSMatrix(style.transform);
                    return {x: matrix.m41, y: matrix.m42};
                }

                document.addEventListener('mousedown', (e) => {
                    if (e.target.isContentEditable) return; // Don't drag if editing text
                    
                    const target = getMovable(e.target);
                    if (!target) return;

                    draggedEl = target;
                    startX = e.clientX;
                    startY = e.clientY;
                    initialTransform = getTranslate(draggedEl);
                    hasMoved = false;
                    
                    // Don't add class yet, wait for move
                    e.preventDefault(); 
                });

                document.addEventListener('mousemove', (e) => {
                    if (!draggedEl) return;
                    e.preventDefault();
                    
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    
                    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                         hasMoved = true;
                         draggedEl.classList.add('is-dragging');
                    }

                    if (!hasMoved) return;
                    
                    // Apply translate
                    draggedEl.style.transform = \`translate3d(\${initialTransform.x + dx}px, \${initialTransform.y + dy}px, 0)\`;
                });

                document.addEventListener('mouseup', () => {
                    if (draggedEl) {
                        draggedEl.classList.remove('is-dragging');
                        draggedEl = null; 
                        if (hasMoved) {
                            postUpdate(); // Only save if actually moved
                        }
                    }
                });

                // Text Edit Logic
                document.addEventListener('dblclick', (e) => {
                    const target = e.target;
                    // Relaxed check: Allow text editing on anything that isn't the root containers
                    // and has some text content.
                    if (target !== document.body && target !== document.documentElement) {
                        e.stopPropagation(); // Only edit the specific clicked element
                        
                        target.setAttribute('contenteditable', 'true');
                        target.focus();
                        
                        // Select all text
                        // Use try-catch as execCommand can be flaky in some contexts
                        try {
                            document.execCommand('selectAll', false, null);
                        } catch(err) {}
                        
                        // Prevent drag while editing
                        const stopProp = (k) => k.stopPropagation();
                        target.addEventListener('keydown', stopProp);
                        target.addEventListener('mousedown', stopProp); // Stop drag start
                        
                        // Save on blur
                        target.addEventListener('blur', () => {
                            target.removeAttribute('contenteditable');
                            target.removeEventListener('keydown', stopProp);
                            target.removeEventListener('mousedown', stopProp);
                            postUpdate();
                        }, {once: true});
                    }
                });

                // CONVERSATION content type: Text-to-speech for dialogue bubbles
                document.querySelectorAll('.audio-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const text = btn.closest('.message-content')?.querySelector('.speech-text')?.textContent;
                        if (text && window.speechSynthesis) {
                            const utterance = new SpeechSynthesisUtterance(text);
                            utterance.lang = document.documentElement.lang || 'en-US';
                            speechSynthesis.speak(utterance);
                        }
                    });
                });
            });
        </script>
    `;

    // Replace absolute file paths with valid Vite src paths and prepend libraries
    const fixedPathHtml = html.replace(/file:\/\/\/.*\/runs\/dna_gene_editing\/generated_images\//g, '/src/routes/ai-video-studio/runs/dna_gene_editing/generated_images/');

    return (includeLibs ? libs : '') + fixedPathHtml;
};

export const AIVideoPlayer: React.FC<AIVideoPlayerProps> = ({
  timelineUrl,
  audioUrl,
  className = "",
  width: propWidth,
  height: propHeight,
  onEntryChange,
  onContentComplete,
}) => {
  // Core state
  const [frames, setFrames] = useState<Frame[]>([]);
  const [meta, setMeta] = useState<TimelineMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use dimensions from meta or props
  const width = propWidth || meta.dimensions?.width || 1920;
  const height = propHeight || meta.dimensions?.height || 1080;

  // Time-driven state (for VIDEO content)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  
  // User-driven state (for QUIZ, STORYBOOK, etc.)
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0);
  
  // Display state
  const [activeFrames, setActiveFrames] = useState<Frame[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaybackSpeedMenu, setShowPlaybackSpeedMenu] = useState(false);
  const [scale, setScale] = useState(0.8);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const navigationRef = useRef<NavigationController | null>(null);

  // Derived values
  const contentType = meta.content_type || "VIDEO";
  const navigationMode = meta.navigation || "time_driven";
  const entryLabel = meta.entry_label || DEFAULT_ENTRY_LABELS[contentType] || "segment";
  const isTimeDriven = navigationMode === "time_driven";
  const isUserDriven = navigationMode === "user_driven";
  const isSelfContained = navigationMode === "self_contained";

  // Content type badge
  const contentTypeBadge = useMemo(() => {
    const config = CONTENT_TYPE_LABELS[contentType];
    return config ? `${config.emoji} ${config.label}` : "🎬 Video";
  }, [contentType]);

  // Load timeline data
  useEffect(() => {
    const loadTimeline = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log("[AIVideoPlayer] Loading timeline from:", timelineUrl);
        const response = await fetch(timelineUrl);
        if (!response.ok) {
          throw new Error(`Failed to load timeline: ${response.statusText}`);
        }

        const timelineData: TimelineData | Frame[] = await response.json();
        console.log("[AIVideoPlayer] Timeline data received:", {
          isArray: Array.isArray(timelineData),
          hasMeta: !Array.isArray(timelineData) && !!timelineData.meta,
          hasEntries: !Array.isArray(timelineData) && !!timelineData.entries,
          dataKeys: Array.isArray(timelineData) ? [] : Object.keys(timelineData),
        });

        // Parse new structure with backward compatibility
        let framesArray: Frame[];
        let timelineMeta: TimelineMeta;
        
        if (Array.isArray(timelineData)) {
          // Old format: just an array of frames (backward compatibility)
          framesArray = timelineData;
          timelineMeta = { 
            ...DEFAULT_META,
            audio_start_at: 0, 
            total_duration: framesArray.length > 0 ? framesArray[framesArray.length - 1].exitTime : 0 
          };
        } else {
          // New format: { meta, entries }
          framesArray = timelineData.entries || [];
          timelineMeta = {
            ...DEFAULT_META,
            ...timelineData.meta,
          };
          
          // Ensure total_duration is set
          if (!timelineMeta.total_duration && framesArray.length > 0) {
            timelineMeta.total_duration = framesArray[framesArray.length - 1].exitTime;
          }
        }
        
        console.log("[AIVideoPlayer] Parsed timeline:", {
          framesCount: framesArray.length,
          meta: timelineMeta,
          contentType: timelineMeta.content_type,
          navigation: timelineMeta.navigation,
          firstFrame: framesArray[0],
          lastFrame: framesArray[framesArray.length - 1],
        });

        setFrames(framesArray);
        setMeta(timelineMeta);

        // Use meta.total_duration if available, otherwise calculate from last frame
        const videoDuration = timelineMeta.total_duration || 
          (framesArray.length > 0 ? framesArray[framesArray.length - 1].exitTime : 0);
        setDuration(videoDuration);
        
        // Initialize navigation controller
        const nav = createNavigationController(
          timelineMeta,
          framesArray,
          (entry, index) => {
            setCurrentEntryIndex(index);
            onEntryChange?.(entry, index);
          }
        );
        navigationRef.current = nav;

        console.log("[AIVideoPlayer] Duration set to:", videoDuration);
      } catch (err) {
        console.error("[AIVideoPlayer] Error loading timeline:", err);
        setError(err instanceof Error ? err.message : "Failed to load timeline");
      } finally {
        setIsLoading(false);
      }
    };

    if (timelineUrl) {
      loadTimeline();
    }

    return () => {
      if (navigationRef.current) {
        navigationRef.current.dispose();
        navigationRef.current = null;
      }
    };
  }, [timelineUrl, onEntryChange]);

  // Initialize audio (only for time-driven content or content with audio)
  useEffect(() => {
    // Skip audio initialization if no audio URL or not time-driven
    if (!audioUrl) {
      if (isTimeDriven) {
        console.log("[AIVideoPlayer] No audio URL provided for time-driven content");
      }
      return;
    }

    const audio = new Audio();
    audioRef.current = audio;

    // Set crossOrigin for S3 URLs to handle CORS
    audio.crossOrigin = "anonymous";
    
    // Set preload to allow metadata loading
    audio.preload = "auto";

    audio.addEventListener("loadedmetadata", () => {
      console.log("[AIVideoPlayer] Audio metadata loaded:", {
        duration: audio.duration,
        readyState: audio.readyState,
      });
    });

    audio.addEventListener("canplay", () => {
      console.log("[AIVideoPlayer] Audio can play");
      setError(null);
    });

    audio.addEventListener("canplaythrough", () => {
      console.log("[AIVideoPlayer] Audio can play through");
    });

    // Set initial playback rate and volume
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.muted = isMuted;

    audio.addEventListener("ended", () => {
      console.log("[AIVideoPlayer] Audio ended, continuing to outro if present");
    });

    audio.addEventListener("error", (e) => {
      console.error("[AIVideoPlayer] Audio error:", {
        error: e,
        errorCode: audio.error?.code,
        errorMessage: audio.error?.message,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.src,
        audioUrl: audioUrl,
      });
      
      let errorMessage = "Failed to load audio";
      if (audio.error) {
        const MEDIA_ERR_ABORTED = 1;
        const MEDIA_ERR_NETWORK = 2;
        const MEDIA_ERR_DECODE = 3;
        const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;
        
        switch (audio.error.code) {
          case MEDIA_ERR_ABORTED:
            errorMessage = "Audio loading aborted";
            break;
          case MEDIA_ERR_NETWORK:
            errorMessage = "Network error loading audio. Check CORS settings.";
            break;
          case MEDIA_ERR_DECODE:
            errorMessage = "Audio decode error";
            break;
          case MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Audio format not supported";
            break;
        }
      }
      setError(errorMessage);
    });

    audio.src = audioUrl;
    
    try {
      audio.load();
    } catch (err) {
      console.error("[AIVideoPlayer] Error calling audio.load():", err);
    }

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      setAudioStarted(false);
    };
  }, [audioUrl, isTimeDriven]);

  // Update active frames based on navigation mode
  useEffect(() => {
    if (frames.length === 0) {
      setActiveFrames([]);
      return;
    }

    if (isTimeDriven) {
      // Time-driven: show frames active at current time
      const active = frames.filter(
        (frame) => currentTime >= frame.inTime && currentTime <= frame.exitTime
      );
      
      let framesToShow = active;
      if (framesToShow.length === 0) {
        const framesAtOrBefore = frames.filter((frame) => frame.inTime <= currentTime);
        if (framesAtOrBefore.length > 0) {
          framesToShow = [framesAtOrBefore[framesAtOrBefore.length - 1]];
        } else {
          framesToShow = [frames[0]];
        }
      }
      
      setActiveFrames(framesToShow);
    } else if (isUserDriven) {
      // User-driven: show current entry
      const currentEntry = frames[currentEntryIndex];
      setActiveFrames(currentEntry ? [currentEntry] : [frames[0]]);
    } else if (isSelfContained) {
      // Self-contained: show first (and only) entry
      setActiveFrames([frames[0]]);
    }
  }, [frames, currentTime, currentEntryIndex, isTimeDriven, isUserDriven, isSelfContained]);

  // Calculate scale to fit iframe content in container
  useEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      if (containerWidth <= 0 || containerHeight <= 0) {
        console.warn("[AIVideoPlayer] Invalid container dimensions:", { containerWidth, containerHeight });
        return;
      }
      
      const scaleX = containerWidth / width;
      const scaleY = containerHeight / height;
      const newScale = Math.min(scaleX, scaleY);
      const zoomedOutScale = newScale * 0.95;
      const finalScale = Math.min(zoomedOutScale, 1);
      
      // Prevent infinite loops by only updating if change is significant (> 0.001)
      setScale(prev => Math.abs(prev - finalScale) > 0.001 ? finalScale : prev);
    };

    // Use a throttled observer to prevent ResizeObserver loop limit errors
    let frameId: number;
    const observerCallback = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => calculateScale());
    };
    
    const resizeObserver = new ResizeObserver(observerCallback);
    
    // Initial calculation
    calculateScale();
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', calculateScale);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateScale);
    };
  }, [width, height]);

  // Update iframe content with active frames
  useEffect(() => {
    if (!iframeRef.current) return;

    const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!iframeDoc) {
      console.warn("[AIVideoPlayer] Cannot access iframe document");
      return;
    }

    if (activeFrames.length === 0) {
      iframeDoc.body.innerHTML = "";
      return;
    }

    console.log("[AIVideoPlayer] Rendering frames:", {
      count: activeFrames.length,
      contentType,
      frames: activeFrames.map((f) => ({ id: f.id, inTime: f.inTime, exitTime: f.exitTime })),
    });

    const sortedFrames = [...activeFrames].sort((a, b) => a.z - b.z);

    // For self-contained content, execute scripts after rendering
    const shouldExecuteScripts = isSelfContained;

    let htmlContent = `
      <!DOCTYPE html>
      <html lang="${meta.target_language || 'en'}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
              position: relative;
              background: #000000;
              margin: 0;
              padding: 0;
            }
            .frame {
              position: absolute;
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          ${fixHtmlContent("", true, contentType)}
    `;

    sortedFrames.forEach((frame) => {
      const frameStyle = frame.htmlStartX !== undefined ? `
        left: ${frame.htmlStartX}px;
        top: ${frame.htmlStartY}px;
        width: ${(frame.htmlEndX || width) - (frame.htmlStartX || 0)}px;
        height: ${(frame.htmlEndY || height) - (frame.htmlStartY || 0)}px;
        z-index: ${frame.z};
      ` : `
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        z-index: ${frame.z};
      `;

      htmlContent += `
        <div class="frame" style="${frameStyle}">
          ${fixHtmlContent(frame.html, false, contentType)}
        </div>
      `;
    });

    htmlContent += `
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // For self-contained content, re-execute scripts
    if (shouldExecuteScripts) {
      const scripts = iframeDoc.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        if (!oldScript.src) {
          const newScript = iframeDoc.createElement('script');
          newScript.textContent = oldScript.textContent;
          oldScript.parentNode?.replaceChild(newScript, oldScript);
        }
      });
    }
  }, [activeFrames, width, height, contentType, isSelfContained, meta.target_language]);

  // Animation loop for time-driven content
  useEffect(() => {
    if (!isTimeDriven) return;

    let lastTimestamp: number | null = null;
    
    const updateTime = (timestamp: number) => {
      if (!isPlaying) return;
      
      const deltaTime = lastTimestamp ? (timestamp - lastTimestamp) / 1000 * playbackRate : 0;
      lastTimestamp = timestamp;
      
      setCurrentTime(prevTime => {
        let newTime = prevTime;
        const audioStartAt = meta.audio_start_at || 0;
        const totalDuration = meta.total_duration || duration;
        
        // INTRO PHASE
        if (prevTime < audioStartAt) {
          newTime = prevTime + deltaTime;
          
          if (newTime >= audioStartAt && audioRef.current && !audioStarted) {
            console.log("[AIVideoPlayer] Intro complete, starting audio");
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => {
              console.error("[AIVideoPlayer] Error starting audio after intro:", err);
            });
            setAudioStarted(true);
            newTime = audioStartAt;
          }
        }
        // CONTENT PHASE
        else if (audioRef.current && !audioRef.current.ended) {
          newTime = audioRef.current.currentTime + audioStartAt;
        }
        // OUTRO PHASE
        else if (audioRef.current && audioRef.current.ended) {
          newTime = prevTime + deltaTime;
          
          if (newTime >= totalDuration) {
            console.log("[AIVideoPlayer] Video complete (including outro)");
            setIsPlaying(false);
            setAudioStarted(false);
            onContentComplete?.();
            return totalDuration;
          }
        }
        
        return Math.min(newTime, totalDuration);
      });
      
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    if (isPlaying) {
      lastTimestamp = null;
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, meta, duration, audioStarted, playbackRate, isTimeDriven, onContentComplete]);

  // Playback controls for time-driven content
  const handlePlayPause = useCallback(() => {
    if (!isTimeDriven) return;
    if (!audioRef.current && audioUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      const audioStartAt = meta.audio_start_at || 0;
      
      if (currentTime >= audioStartAt && audioRef.current) {
        const audioTime = currentTime - audioStartAt;
        audioRef.current.currentTime = Math.max(0, audioTime);
        audioRef.current.play().catch((err) => {
          console.error("Error playing audio:", err);
          setError("Failed to play audio");
        });
        if (!audioStarted) {
          setAudioStarted(true);
        }
      }
      
      setIsPlaying(true);
    }
  }, [isPlaying, meta, currentTime, audioStarted, isTimeDriven, audioUrl]);

  const handleReset = useCallback(() => {
    if (isTimeDriven) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.pause();
      }
      setCurrentTime(0);
      setIsPlaying(false);
      setAudioStarted(false);
    } else {
      setCurrentEntryIndex(0);
      navigationRef.current?.goTo(0);
    }
  }, [isTimeDriven]);

  const handleSeek = useCallback((value: number[]) => {
    if (!isTimeDriven) return;
    
    const newTimelineTime = value[0];
    const audioStartAt = meta.audio_start_at || 0;
    
    setCurrentTime(newTimelineTime);
    
    if (audioRef.current) {
      if (newTimelineTime < audioStartAt) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setAudioStarted(false);
      } else {
        const audioTime = newTimelineTime - audioStartAt;
        audioRef.current.currentTime = Math.max(0, audioTime);
        
        if (isPlaying && newTimelineTime < (meta.content_ends_at || duration)) {
          if (!audioStarted) {
            setAudioStarted(true);
          }
          audioRef.current.play().catch(err => {
            console.error("[AIVideoPlayer] Error playing audio after seek:", err);
          });
        }
      }
    }
  }, [meta, isPlaying, audioStarted, duration, isTimeDriven]);

  const handleBackward = useCallback(() => {
    const newTimelineTime = Math.max(0, currentTime - 10);
    handleSeek([newTimelineTime]);
  }, [currentTime, handleSeek]);

  const handleForward = useCallback(() => {
    const totalDuration = meta.total_duration || duration;
    const newTimelineTime = Math.min(totalDuration, currentTime + 10);
    handleSeek([newTimelineTime]);
  }, [currentTime, meta, duration, handleSeek]);

  // Navigation controls for user-driven content
  const handlePrevEntry = useCallback(() => {
    if (!isUserDriven || !navigationRef.current) return;
    
    const entry = navigationRef.current.prev();
    if (entry) {
      setCurrentEntryIndex(navigationRef.current.currentIndex);
    }
  }, [isUserDriven]);

  const handleNextEntry = useCallback(() => {
    if (!isUserDriven || !navigationRef.current) return;
    
    const entry = navigationRef.current.next();
    if (entry) {
      setCurrentEntryIndex(navigationRef.current.currentIndex);
    } else if (navigationRef.current.currentIndex === frames.length - 1) {
      // Last entry reached
      onContentComplete?.();
    }
  }, [isUserDriven, frames.length, onContentComplete]);

  // Playback rate and volume controls
  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setShowPlaybackSpeedMenu(false);
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      audioRef.current.muted = newMuted;
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1);
        audioRef.current.volume = 1;
      }
    }
  }, [isMuted]);

  // Print handler for WORKSHEET content
  const handlePrint = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  }, []);

  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Close playback speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPlaybackSpeedMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.playback-speed-menu')) {
          setShowPlaybackSpeedMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlaybackSpeedMenu]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get progress display
  const progressDisplay = useMemo(() => {
    if (isUserDriven || isSelfContained) {
      const label = entryLabel.charAt(0).toUpperCase() + entryLabel.slice(1);
      const current = currentEntryIndex + 1;
      const total = frames.length;
      return `${label} ${current} of ${total}`;
    }
    return null;
  }, [isUserDriven, isSelfContained, entryLabel, currentEntryIndex, frames.length]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ aspectRatio: "16/9" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {contentTypeBadge}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 rounded-lg border border-red-200 ${className}`} style={{ aspectRatio: "16/9" }}>
        <div className="text-center p-4">
          <p className="text-red-600 font-semibold mb-2">Error</p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black rounded-lg overflow-hidden flex flex-col ${className}`} style={{ aspectRatio: "16/9", maxHeight: "calc(100vh - 150px)" }}>
      {/* Content Type Badge */}
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800">
        <span className="text-white text-sm font-medium">{contentTypeBadge}</span>
        {progressDisplay && (
          <span className="text-gray-400 text-sm">{progressDisplay}</span>
        )}
        {/* Print button for WORKSHEET */}
        {contentType === "WORKSHEET" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 h-8 px-3"
            title="Print Worksheet"
          >
            <Printer className="h-3 w-3 mr-1" />
            Print
          </Button>
        )}
      </div>

      {/* Video Frame */}
      <div 
        ref={containerRef}
        className="relative w-full flex-1 bg-black overflow-hidden flex items-center justify-center" 
        style={{ minHeight: 0, position: 'relative' }}
      >
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            position: 'relative',
          }}
        >
          <iframe
            ref={iframeRef}
            className="border-0 bg-black"
            sandbox="allow-scripts allow-same-origin allow-modals"
            title="AI Video Player"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              display: "block",
              backgroundColor: "#000000",
            }}
          />
        </div>
      </div>

      {/* Controls - Different layout based on navigation mode */}
      <div className="bg-gray-900 p-4 space-y-3 flex-shrink-0">
        {/* Time-Driven Controls (VIDEO) */}
        {isTimeDriven && (
          <>
            {/* Progress Slider */}
            <div className="flex items-center gap-3">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-white text-sm font-mono min-w-[60px] text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between gap-4">
              {/* Left Side: Playback Controls */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleBackward}
                  className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                  disabled={!audioRef.current && !!audioUrl}
                  title="Rewind 10 seconds"
                >
                  <Rewind className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePlayPause}
                  className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                  disabled={!audioRef.current && !!audioUrl}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleForward}
                  className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                  disabled={!audioRef.current && !!audioUrl}
                  title="Forward 10 seconds"
                >
                  <FastForward className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                  disabled={!audioRef.current && !!audioUrl}
                  title="Reset to beginning"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* Right Side: Volume and Speed Controls */}
              <div className="flex items-center gap-4">
                {/* Volume Control */}
                <div className="flex items-center gap-3 min-w-[120px] max-w-[180px]">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleToggleMute}
                    className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 h-8 w-8"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={(value) => handleVolumeChange(value[0])}
                    className="flex-1"
                  />
                </div>

                {/* Playback Speed Control */}
                <div className="relative playback-speed-menu">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPlaybackSpeedMenu(!showPlaybackSpeedMenu)}
                    className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 h-8 px-3"
                    title="Playback speed"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    {playbackRate}x
                  </Button>
                  {showPlaybackSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[100px]">
                      {playbackSpeeds.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handlePlaybackRateChange(speed)}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                            playbackRate === speed ? "bg-gray-700 text-primary" : "text-white"
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* User-Driven Controls (QUIZ, STORYBOOK, WORKSHEET, etc.) */}
        {isUserDriven && (
          <div className="flex items-center justify-between gap-4">
            {/* Left Side: Navigation */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevEntry}
                disabled={currentEntryIndex === 0}
                className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 disabled:opacity-50"
                title="Previous"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <span className="text-white text-sm px-3">
                {progressDisplay}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextEntry}
                disabled={currentEntryIndex === frames.length - 1}
                className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 disabled:opacity-50"
                title="Next"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Right Side: Reset */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
              title="Reset to beginning"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Self-Contained Controls (INTERACTIVE_GAME, SIMULATION, CODE_PLAYGROUND) */}
        {isSelfContained && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
              title="Reset"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <span className="text-gray-400 text-sm">
              Interact with the content above
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
