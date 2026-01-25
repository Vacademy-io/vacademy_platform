import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Rewind, FastForward, Volume2, VolumeX, Settings } from "lucide-react";

export interface Frame {
  inTime: number;
  exitTime: number;
  html: string;
  id: string;
  z: number;
  htmlStartX: number;
  htmlStartY: number;
  htmlEndX: number;
  htmlEndY: number;
}

export interface AIVideoPlayerProps {
  timelineUrl: string;
  audioUrl: string;
  className?: string;
  width?: number;
  height?: number;
}

const fixHtmlContent = (html: string, includeLibs = true) => {
    // Inject required libraries (GSAP, MotionPath, Mermaid) + Interaction Script
    const libs = `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
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
                const getMovable = (target) => {
                    if(!target || target === document.body) return null;
                    // Move up until we find a block level element or the body
                    const style = window.getComputedStyle(target);
                    if (style.display === 'block' || style.display === 'flex' || target.tagName === 'IMG') return target;
                    return getMovable(target.parentElement);
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
  width = 1920,
  height = 1080,
}) => {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFrames, setActiveFrames] = useState<Frame[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaybackSpeedMenu, setShowPlaybackSpeedMenu] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [scale, setScale] = useState(0.8); // Initialize with 0.8 for immediate zoom out

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

        const timelineData = await response.json();
        console.log("[AIVideoPlayer] Timeline data received:", {
          isArray: Array.isArray(timelineData),
          hasFrames: !!timelineData.frames,
          dataKeys: Object.keys(timelineData),
        });

        const framesArray = Array.isArray(timelineData) ? timelineData : timelineData.frames || [];
        console.log("[AIVideoPlayer] Frames array:", {
          count: framesArray.length,
          firstFrame: framesArray[0],
          lastFrame: framesArray[framesArray.length - 1],
        });

        setFrames(framesArray);

        // Calculate duration from last frame
        if (framesArray.length > 0) {
          const lastFrame = framesArray[framesArray.length - 1];
          setDuration(lastFrame.exitTime || 0);
          console.log("[AIVideoPlayer] Duration set to:", lastFrame.exitTime);
        }
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
  }, [timelineUrl]);

  // Initialize audio
  useEffect(() => {
    if (!audioUrl) return;

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
      if (audio.duration && audio.duration > 0) {
        setDuration(audio.duration);
      }
    });

    audio.addEventListener("canplay", () => {
      console.log("[AIVideoPlayer] Audio can play");
      setError(null);
    });

    audio.addEventListener("canplaythrough", () => {
      console.log("[AIVideoPlayer] Audio can play through");
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    // Set initial playback rate and volume
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.muted = isMuted;

    // Set initial playback rate and volume
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.muted = isMuted;

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
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
      
      // Provide more specific error messages
      let errorMessage = "Failed to load audio";
      if (audio.error) {
        // MediaError enum values
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

    // Set the audio source after setting up listeners
    audio.src = audioUrl;
    
    // Try to load the audio (load() is synchronous, errors are handled via error event listener)
    try {
      audio.load();
    } catch (err) {
      console.error("[AIVideoPlayer] Error calling audio.load():", err);
    }

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Update active frames based on current time
  useEffect(() => {
    const active = frames.filter(
      (frame) => currentTime >= frame.inTime && currentTime <= frame.exitTime
    );
    
    // If no active frames at current time, show the first frame(s) that start at or before current time
    // This ensures something is always displayed
    let framesToShow = active;
    if (framesToShow.length === 0 && frames.length > 0) {
      // Find frames that should be visible at current time (including those that haven't started yet but are closest)
      const framesAtOrBefore = frames.filter((frame) => frame.inTime <= currentTime);
      if (framesAtOrBefore.length > 0) {
        // Show the most recent frame that started before or at current time
        framesToShow = [framesAtOrBefore[framesAtOrBefore.length - 1]];
      } else {
        // If no frames have started yet, show the first frame
        framesToShow = [frames[0]];
      }
    }
    
    console.log("[AIVideoPlayer] Active frames update:", {
      currentTime,
      totalFrames: frames.length,
      activeCount: active.length,
      showingCount: framesToShow.length,
    });
    
    setActiveFrames(framesToShow);
  }, [frames, currentTime]);

  // Calculate scale to fit iframe content in container
  useEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current) return;
      
      // Use getBoundingClientRect for more accurate measurements
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      // Only calculate if we have valid dimensions
      if (containerWidth <= 0 || containerHeight <= 0) {
        console.warn("[AIVideoPlayer] Invalid container dimensions:", { containerWidth, containerHeight });
        return;
      }
      
      // Calculate scale to fit 1920x1080 content into container
      // Use Math.min to ensure content fits both dimensions (maintains aspect ratio)
      const scaleX = containerWidth / width;
      const scaleY = containerHeight / height;
      const newScale = Math.min(scaleX, scaleY);
      
       // Apply 0.95 multiplier to zoom out (make it 95% of calculated scale)
       const zoomedOutScale = newScale * 0.95;
      
      // Cap at 1 to prevent zooming in beyond 100% (only scale down, never up)
      const finalScale = Math.min(zoomedOutScale, 1);
      
      setScale(finalScale);
      console.log("[AIVideoPlayer] Scale calculated:", {
        containerWidth: containerWidth.toFixed(2),
        containerHeight: containerHeight.toFixed(2),
        contentWidth: width,
        contentHeight: height,
        scaleX: scaleX.toFixed(4),
        scaleY: scaleY.toFixed(4),
        calculatedScale: newScale.toFixed(4),
        finalScale: finalScale.toFixed(4),
      });
    };

    // Calculate immediately and also after a delay to ensure layout is complete
    calculateScale();
    const timeoutId = setTimeout(() => {
      calculateScale();
    }, 100);
    
    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        setTimeout(calculateScale, 50);
      });
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', calculateScale);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateScale);
    };
  }, [width, height]);

  // Update iframe content with active frames
  useEffect(() => {
    if (!iframeRef.current) {
      return;
    }

    const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!iframeDoc) {
      console.warn("[AIVideoPlayer] Cannot access iframe document");
      return;
    }

    // If no active frames, show empty/black background
    if (activeFrames.length === 0) {
      console.log("[AIVideoPlayer] No active frames, clearing iframe");
      iframeDoc.body.innerHTML = "";
      return;
    }

    console.log("[AIVideoPlayer] Rendering frames:", {
      count: activeFrames.length,
      frames: activeFrames.map((f) => ({ id: f.id, inTime: f.inTime, exitTime: f.exitTime })),
    });

    // Sort frames by z-index
    const sortedFrames = [...activeFrames].sort((a, b) => a.z - b.z);

    // Build HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
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
          ${fixHtmlContent("", true)}
    `;

    sortedFrames.forEach((frame) => {
      htmlContent += `
        <div class="frame" style="
          left: ${frame.htmlStartX}px;
          top: ${frame.htmlStartY}px;
          width: ${frame.htmlEndX - frame.htmlStartX}px;
          height: ${frame.htmlEndY - frame.htmlStartY}px;
          z-index: ${frame.z};
        ">
          ${fixHtmlContent(frame.html, false)}
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
  }, [activeFrames, width, height]);

  // Animation loop for smooth updates
  useEffect(() => {
    const updateTime = () => {
      if (audioRef.current && isPlaying) {
        setCurrentTime(audioRef.current.currentTime);
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error("Error playing audio:", err);
        setError("Failed to play audio");
      });
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleReset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      audioRef.current.pause();
    }
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleBackward = useCallback(() => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - 10);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleForward = useCallback(() => {
    if (audioRef.current) {
      const newTime = Math.min(duration, audioRef.current.currentTime + 10);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

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

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ aspectRatio: "16/9" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video...</p>
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
            sandbox="allow-scripts allow-same-origin"
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

      {/* Controls - Always visible */}
      <div className="bg-gray-900 p-4 space-y-3 flex-shrink-0">
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

        {/* Control Buttons - Left and Right aligned */}
        <div className="flex items-center justify-between gap-4">
          {/* Left Side: Playback Controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBackward}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
              disabled={!audioRef.current}
              title="Rewind 10 seconds"
            >
              <Rewind className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayPause}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
              disabled={!audioRef.current}
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
              disabled={!audioRef.current}
              title="Forward 10 seconds"
            >
              <FastForward className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
              disabled={!audioRef.current}
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
      </div>
    </div>
  );
};

