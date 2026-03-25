import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Monitor,
    Smartphone,
    Tablet,
    LogOut,
    RefreshCw,
    AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import { TERMINATE_SESSION } from "@/constants/urls";
import { toast } from "sonner";

interface ActiveSession {
    session_id: string;
    device_type: string;
    ip_address: string | null;
    login_time: string;
    last_activity_time: string;
}

interface SessionLimitDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activeSessions: ActiveSession[];
    onSessionTerminated: () => void;
    onRetryLogin: () => void;
}

function getDeviceIcon(deviceType: string) {
    switch (deviceType?.toUpperCase()) {
        case "MOBILE":
            return <Smartphone className="w-5 h-5" />;
        case "TABLET":
            return <Tablet className="w-5 h-5" />;
        default:
            return <Monitor className="w-5 h-5" />;
    }
}

function formatDate(dateString: string): string {
    try {
        return new Date(dateString).toLocaleString();
    } catch {
        return dateString;
    }
}

export function SessionLimitDialog({
    open,
    onOpenChange,
    activeSessions,
    onSessionTerminated,
    onRetryLogin,
}: SessionLimitDialogProps) {
    const [sessions, setSessions] = useState<ActiveSession[]>(activeSessions);
    const [terminatingId, setTerminatingId] = useState<string | null>(null);

    // Sync sessions when activeSessions prop changes
    useEffect(() => {
        if (activeSessions.length > 0) {
            setSessions(activeSessions);
        }
    }, [activeSessions]);

    const handleTerminateSession = async (sessionId: string) => {
        setTerminatingId(sessionId);
        try {
            await axios.post(`${TERMINATE_SESSION}?sessionId=${sessionId}`);
            const updatedSessions = sessions.filter(
                (s) => s.session_id !== sessionId
            );
            setSessions(updatedSessions);
            toast.success("Session terminated successfully");
            onSessionTerminated();

            if (updatedSessions.length === 0) {
                onRetryLogin();
            }
        } catch (error) {
            console.error("Failed to terminate session:", error);
            toast.error("Failed to terminate session. Please try again.");
        } finally {
            setTerminatingId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-gray-900">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Session Limit Reached
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-600 pt-1">
                        You've reached the maximum number of active sessions.
                        Please log out of one session to continue.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 mt-2">
                    {sessions.map((session, index) => (
                        <motion.div
                            key={session.session_id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors duration-150"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                    {getDeviceIcon(session.device_type)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                        {session.device_type || "Unknown Device"}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        Login: {formatDate(session.login_time)}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                        Last active:{" "}
                                        {formatDate(session.last_activity_time)}
                                    </p>
                                </div>
                            </div>

                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={terminatingId === session.session_id}
                                onClick={() =>
                                    handleTerminateSession(session.session_id)
                                }
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {terminatingId === session.session_id ? (
                                    <>
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                ease: "linear",
                                            }}
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                        </motion.div>
                                        Logging out...
                                    </>
                                ) : (
                                    <>
                                        <LogOut className="w-3 h-3" />
                                        Log Out
                                    </>
                                )}
                            </motion.button>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={onRetryLogin}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-150"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry Login
                    </motion.button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
