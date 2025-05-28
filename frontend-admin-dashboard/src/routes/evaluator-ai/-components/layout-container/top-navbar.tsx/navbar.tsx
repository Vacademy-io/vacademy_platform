import { SidebarTrigger } from "@/components/ui/sidebar";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useSidebarStore } from "@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/global-states";
import { SidebarSimple } from "@phosphor-icons/react";

export function Navbar() {
    const { navHeading } = useNavHeadingStore();
    const { sidebarOpen, setSidebarOpen } = useSidebarStore();

    return (
        <div className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b bg-neutral-50 px-8 py-4">
            <div className="flex items-center gap-4">
                <SidebarTrigger onClick={() => setSidebarOpen(!sidebarOpen)}>
                    <SidebarSimple className="text-neutral-600" />
                </SidebarTrigger>
                <div className="border-l border-neutral-500 px-4 text-h3 font-semibold text-neutral-600">
                    {navHeading}
                </div>
            </div>
            <div className="flex gap-6 text-neutral-600">
                <div className="flex items-center gap-1"></div>
            </div>
        </div>
    );
}
