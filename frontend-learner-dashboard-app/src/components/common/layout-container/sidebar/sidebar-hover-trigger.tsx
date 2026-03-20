import { useSidebar } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

export const SidebarHoverTrigger = () => {
    const { setOpen } = useSidebar();
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(
        null
    );

    const handleMouseEnter = () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        setOpen(true);
    };

    const handleMouseLeave = () => {
        const timeout = setTimeout(() => {
            setOpen(false);
        }, 300); 
        setHoverTimeout(timeout);
    };

    useEffect(() => {
        const leftEdgeDiv = document.createElement("div");
        leftEdgeDiv.style.position = "fixed";
        leftEdgeDiv.style.left = "0";
        leftEdgeDiv.style.top = "0";
        leftEdgeDiv.style.bottom = "0";
        leftEdgeDiv.style.width = "20px";
        leftEdgeDiv.style.zIndex = "9998";
        
        document.body.appendChild(leftEdgeDiv);

        leftEdgeDiv.addEventListener("mouseenter", handleMouseEnter);
        
        const sidebar = document.querySelector('[data-sidebar="sidebar"]');
        if (sidebar) {
            sidebar.addEventListener("mouseleave", handleMouseLeave);
        }

        return () => {
            document.body.removeChild(leftEdgeDiv);
            if (sidebar) {
                sidebar.removeEventListener("mouseleave", handleMouseLeave);
            }
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
        };
    }, []);

    return null;
}; 