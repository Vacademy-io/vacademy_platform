import { useState, useEffect, useRef } from "react";
import { MessageCircle, Sparkles, HelpCircle, BookOpen } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { useChatbotContext } from "./useChatbotContext";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/services/chatbot-settings";
import { AnimatePresence, motion } from "framer-motion";

const ROTATING_MESSAGES = [
  { text: "Any doubts?", icon: HelpCircle },
  { text: "Learn something new?", icon: Sparkles },
  { text: "Practice questions?", icon: BookOpen },
];

const LONG_PROMPT = "How can I help you in your learning journey today?";

export const ChatbotFloatingButton = () => {
  const { isOpen, setIsOpen, shouldShowChatbot, chatbotSettings } =
    useChatbotContext();
  const location = useLocation();

  // Move button higher on video/slide pages to avoid overlapping player controls
  const isOnVideoPage = location.pathname.includes("/slides") || location.pathname.includes("/content");
  const isNativePlatform = Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios";

  const [isHovered, setIsHovered] = useState(false);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [showPill, setShowPill] = useState(false);
  const [showLongPrompt, setShowLongPrompt] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timeout
  const clearCurrentTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    // Start the cycle after mount
    timeoutRef.current = setTimeout(() => {
      cycleMessages();
    }, 3000);

    return () => clearCurrentTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycleMessages = () => {
    clearCurrentTimeout();

    // 1. Show Pill with current message
    setShowPill(true);

    // 2. Hide Pill after 4s
    timeoutRef.current = setTimeout(() => {
      setShowPill(false);
      
      // 3. Wait 2s, then either show Long Prompt or Next Pill
      timeoutRef.current = setTimeout(() => {
        
        setActiveMessageIndex((prev) => {
          const next = (prev + 1) % ROTATING_MESSAGES.length;
          
          if (next === 0) {
             // We completed a loop, show the long prompt
             setShowLongPrompt(true);
             timeoutRef.current = setTimeout(() => {
               setShowLongPrompt(false);
               // Restart cycle after long prompt fades
               timeoutRef.current = setTimeout(cycleMessages, 2000);
             }, 6000); // Show long prompt for 6s
          } else {
             // Continue cycle after a short delay to avoid sync recursion
             timeoutRef.current = setTimeout(cycleMessages, 100);
          }
          return next;
        });

      }, 2000); // Wait in idle state
    }, 4000); // Show pill for 4s
  };
  
  if (!shouldShowChatbot()) {
    return null;
  }

  // Hide the floating button when the panel is open
  if (isOpen) {
    return null;
  }

  const CurrentIcon = ROTATING_MESSAGES[activeMessageIndex].icon;

  return (
    <div className={cn(
      "fixed right-6 z-[990] flex flex-col items-end gap-3 pointer-events-none",
      isOnVideoPage ? "bottom-20" : "bottom-6",
      isNativePlatform && "mb-10"
    )}>
      
      {/* Long Prompt Bubble (appears above) */}
      <AnimatePresence>
        {showLongPrompt && !isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="bg-background border border-border shadow-lg rounded-xl p-3 max-w-[200px] pointer-events-auto relative mr-2"
          >
            <div className="text-sm font-medium text-foreground relative z-10">
               {LONG_PROMPT}
            </div>
            {/* Arrow */}
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-background border-b border-r border-border transform rotate-45"></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto relative">
          {/* Pulsing Glow Ring - draws attention */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/30"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Main Button */}
          <motion.button
            layout
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => setIsOpen(true)}
            className={cn(
              "relative h-14 shadow-2xl flex items-center justify-center focus:outline-none overflow-hidden group",
              avatarUrl ? "rounded-full bg-background p-0" : "rounded-full bg-primary text-primary-foreground"
            )}
            initial={{ width: 56 }} // w-14
            animate={{ 
              width: (showPill || isHovered) ? "auto" : 56,
              scale: isHovered ? 1.05 : 1
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
             <div className="flex items-center px-1">
                {/* Avatar / Icon Container */}
                <div className="w-14 h-14 flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <motion.div 
                        className="w-full h-full p-0.5"
                        animate={{ rotate: (showPill || isHovered) ? 360 : 0 }}
                        transition={{ duration: 0.5 }}
                    >
                      <img
                        src={avatarUrl}
                        alt={chatbotSettings.assistant_name}
                        className="w-full h-full object-cover rounded-full border-2 border-primary/20"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                       key={activeMessageIndex}
                       initial={{ scale: 0.5, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       transition={{ duration: 0.2 }}
                    >
                        {/* Show specific icon for the message if showing pill, else default icon */}
                        {(showPill || isHovered) ? <CurrentIcon className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
                    </motion.div>
                  )}
                </div>

                {/* Text Label (Truncated in idle, reveals in expanded) */}
                <AnimatePresence mode="wait">
                  {(showPill || isHovered) && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap font-medium pr-5 pl-1 overflow-hidden h-full flex items-center"
                    >
                      {ROTATING_MESSAGES[activeMessageIndex].text}
                    </motion.span>
                  )}
                </AnimatePresence>
             </div>
          </motion.button>
          
          {/* Notification Dot (Optional - just visual flair) */}
          <motion.div 
            className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white z-10"
            initial={{ scale: 0 }}
            animate={{ scale: (showPill || isHovered) ? 0 : 1 }}
          />
      </div>
    </div>
  );
};
