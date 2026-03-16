import { MySidebar } from "./sidebar/mySidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { Navbar } from "./top-navbar.tsx/navbar";
import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import useStore from "./sidebar/useSidebar";
import { ChatbotSidePanel } from "@/components/chatbot/ChatbotSidePanel";
import { useChatbotPanelStore } from "@/stores/chatbot/useChatbotPanelStore";
import { useChatbotContext } from "@/components/chatbot/useChatbotContext";

interface LayoutContainerProps {
    children?: React.ReactNode;
    className?: string;
    sidebarComponent?: React.ReactNode;
    /**
     * Enable the chatbot side panel for this layout.
     * When enabled, the chatbot will render as a docked panel on the right
     * instead of a floating overlay.
     */
    enableChatbotPanel?: boolean;
}

export const LayoutContainer = ({
    children,
    className,
    sidebarComponent,
    enableChatbotPanel = true, // Docked panel enabled by default
}: LayoutContainerProps) => {
    const { setHasCustomSidebar } = useStore();
    const { isOpen: chatbotIsOpen } = useChatbotContext();
    const { panelWidth, setIsDockedMode } = useChatbotPanelStore();
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768); // md breakpoint
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Set docked mode based on enableChatbotPanel prop (and not mobile)
    useEffect(() => {
        setIsDockedMode(enableChatbotPanel && !isMobile);
        return () => setIsDockedMode(false);
    }, [enableChatbotPanel, isMobile, setIsDockedMode]);

    React.useEffect(() => {
        setHasCustomSidebar(!!sidebarComponent);
        return () => setHasCustomSidebar(false);
    }, [sidebarComponent, setHasCustomSidebar]);

    // Show docked panel only on desktop when enableChatbotPanel is true
    const showDockedPanel = enableChatbotPanel && chatbotIsOpen && !isMobile;

    return (
        <>
            <MySidebar sidebarComponent={sidebarComponent} />
            <SidebarInset
                className="overflow-x-hidden w-full"
                style={{
                    // Reduce content width when chatbot panel is open (desktop only)
                    marginRight: showDockedPanel ? `${panelWidth}px` : "0",
                    transition: "margin-right 0.2s ease-in-out",
                }}
            >
                <Navbar />
                <div className={cn("m-3 md:m-5 max-w-full overflow-x-hidden", className)}>
                    {children}
                </div>
            </SidebarInset>
            {/* Docked Chatbot Side Panel - fixed position on the right */}
            {showDockedPanel && (
                <div
                    className="fixed top-0 right-0 h-screen z-50"
                    style={{ width: panelWidth }}
                >
                    <ChatbotSidePanel />
                </div>
            )}
        </>
    );
};


