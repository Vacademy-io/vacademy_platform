import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";
import { formatVideoTime } from "@/utils/study-library/tracking/formatVideoTime";

interface TimestampDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTimestampSet: (timestamp: number, formattedTime: string) => void;
    initialTimestamp?: number;
}

export const CurrentPositionButton = ({isDocument, setPageNumber, isVideo, setHours, setMinutes, setSeconds, clearValidationError}: {isDocument: boolean, setPageNumber: (pageNumber: string) => void, isVideo: boolean, setHours: (hours: string) => void, setMinutes: (minutes: string) => void, setSeconds: (seconds: string) => void, clearValidationError: () => void}) => {

    const {activeItem} = useContentStore();

    const { 
        currentPdfPage, 
        currentYoutubeTime, 
        currentUploadedVideoTime,
    } = useMediaRefsStore();

    const getCurrentPosition = () => {
        if (isDocument) {
            // Display current page + 1 for user-friendly 1-based indexing
            setPageNumber(String(currentPdfPage + 1));
        } else if (isVideo) {
            const currentTime = activeItem?.video_slide?.source_type === "FILE_ID" 
                ? currentUploadedVideoTime 
                : currentYoutubeTime;
            
            const totalSeconds = Math.floor(currentTime);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            
            setHours(String(h));
            setMinutes(String(m));
            setSeconds(String(s));
        }
        // Clear validation error when setting current position
        clearValidationError();
    };
    return(
        <MyButton 
            buttonType="secondary" 
            scale="medium"
            onClick={getCurrentPosition}
        >
            {isDocument ? "Use Current Page" : "Use Current Position"}
        </MyButton>
    )
}

export const TimestampDialog = ({ open, onOpenChange, onTimestampSet, initialTimestamp }: TimestampDialogProps) => {
    const { activeItem } = useContentStore();
    const { 
        currentYoutubeVideoLength,
        currentPdfLength,
        currentCustomVideoLength
    } = useMediaRefsStore();
    
    const [hours, setHours] = useState("");
    const [minutes, setMinutes] = useState("");
    const [seconds, setSeconds] = useState("");
    const [pageNumber, setPageNumber] = useState("");
    const [validationError, setValidationError] = useState("");

    const isVideo = activeItem?.source_type === "VIDEO";
    const isDocument = activeItem?.source_type === "DOCUMENT";

    // Get the appropriate media length based on the active item
    const getMediaLength = () => {
        if (isDocument) {
            return currentPdfLength;
        } else if (isVideo) {
            return activeItem?.video_slide?.source_type === "FILE_ID" 
                ? currentCustomVideoLength 
                : currentYoutubeVideoLength;
        }
        return 0;
    };

    const mediaLength = getMediaLength();

    // Initialize values when dialog opens or initialTimestamp changes
    useEffect(() => {
        if (open) {
            if (initialTimestamp !== undefined) {
                if (isDocument) {
                    // Display page number + 1 for user-friendly 1-based indexing
                    setPageNumber(String(initialTimestamp + 1));
                } else if (isVideo) {
                    const totalSeconds = Math.floor(initialTimestamp / 1000);
                    const h = Math.floor(totalSeconds / 3600);
                    const m = Math.floor((totalSeconds % 3600) / 60);
                    const s = totalSeconds % 60;
                    setHours(String(h));
                    setMinutes(String(m));
                    setSeconds(String(s));
                }
            } else {
                // Reset to empty values
                setHours("");
                setMinutes("");
                setSeconds("");
                setPageNumber("");
            }
            // Clear validation error when dialog opens
            setValidationError("");
        }
    }, [open, initialTimestamp, isDocument, isVideo]);

    // Validate input against media length
    const validateInput = () => {
        if (isDocument) {
            const pageNum = parseInt(pageNumber) || 0;
            if (mediaLength > 0 && pageNum > mediaLength) {
                setValidationError(`Page number cannot exceed ${mediaLength} (total pages)`);
                return false;
            }
        } else if (isVideo) {
            const h = parseInt(hours) || 0;
            const m = parseInt(minutes) || 0;
            const s = parseInt(seconds) || 0;
            const totalSeconds = h * 3600 + m * 60 + s;
            
            if (mediaLength > 0 && totalSeconds > mediaLength) {
                const maxHours = Math.floor(mediaLength / 3600);
                const maxMinutes = Math.floor((mediaLength % 3600) / 60);
                const maxSeconds = Math.floor(mediaLength % 60);
                setValidationError(`Time cannot exceed ${maxHours}:${maxMinutes.toString().padStart(2, '0')}:${maxSeconds.toString().padStart(2, '0')} (video length)`);
                return false;
            }
        }
        setValidationError("");
        return true;
    };

    const handleNumericInput = (
        e: React.ChangeEvent<HTMLInputElement>,
        setter: React.Dispatch<React.SetStateAction<string>>,
        max?: number
    ) => {
        const value = e.target.value;
        if (value === "" || (/^\d+$/.test(value) && (!max || parseInt(value) <= max))) {
            setter(value);
            // Clear validation error when user starts typing
            setValidationError("");
        }
    };

    const handleSubmit = () => {
        // Validate input first
        if (!validateInput()) {
            return;
        }

        if (isDocument) {
            const displayPageNumber = parseInt(pageNumber) || 1;
            // Send 0-indexed page number but display 1-indexed
            const actualPageNumber = displayPageNumber - 1;
            onTimestampSet(actualPageNumber, `Page ${displayPageNumber}`);
        } else if (isVideo) {
            const h = parseInt(hours) || 0;
            const m = parseInt(minutes) || 0;
            const s = parseInt(seconds) || 0;
            
            const totalSeconds = h * 3600 + m * 60 + s;
            const timestampInMs = totalSeconds * 1000;
            
            // Use the existing formatVideoTime utility for consistency
            const formattedTime = formatVideoTime(totalSeconds);
            
            onTimestampSet(timestampInMs, formattedTime);
        }
        onOpenChange(false);
    };

    const isValidInput = () => {
        // Check if there are any validation errors
        if (validationError) {
            return false;
        }
        
        if (isDocument) {
            return pageNumber !== "" && parseInt(pageNumber) >= 1;
        } else if (isVideo) {
            return hours !== "" || minutes !== "" || seconds !== "";
        }
        return false;
    };

    return (
        <div style={{ zIndex: 20000 }} className="relative">
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent 
                    className="max-w-md z-[20000] fixed bg-white/95 backdrop-blur-xl border border-gray-200/60 shadow-2xl rounded-2xl overflow-hidden" 
                    style={{ zIndex: 20000 }}
                >
                <DialogHeader className="border-b border-gray-100/80 bg-gradient-to-r from-white to-primary-50/30 p-6 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-sm">
                            {isDocument ? (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <DialogTitle className="text-lg font-bold text-gray-900 tracking-tight">
                            {isDocument ? "Set Page Number" : "Set Timestamp"}
                        </DialogTitle>
                    </div>
                </DialogHeader>
                
                <div className="p-6 bg-white">
                    <div className="flex gap-2 flex-col justify-between">
                    {isDocument ? (
                        <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center justify-between w-full gap-2">
                            <MyInput
                                inputType="text"
                                inputPlaceholder="Enter page number"
                                input={pageNumber}
                                onChangeFunction={(e) => handleNumericInput(e, setPageNumber)}
                                onBlur={validateInput}
                                size="medium"
                                className="w-fit"
                            />
                            <CurrentPositionButton isDocument={isDocument} setPageNumber={setPageNumber} isVideo={isVideo} setHours={setHours} setMinutes={setMinutes} setSeconds={setSeconds} clearValidationError={() => setValidationError("")} />
                        </div>
                            {mediaLength > 0 && (
                                <p className="text-xs text-gray-500">
                                    Total pages: {mediaLength}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-2">
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="00"
                                        input={hours}
                                        onChangeFunction={(e) => handleNumericInput(e, setHours, 23)}
                                        onBlur={validateInput}
                                        size="small"
                                        className="w-16 text-center"
                                    />
                                    <span className="text-lg">:</span>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="00"
                                        input={minutes}
                                        onChangeFunction={(e) => handleNumericInput(e, setMinutes, 59)}
                                        onBlur={validateInput}
                                        size="small"
                                        className="w-16 text-center"
                                    />
                                    <span className="text-lg">:</span>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="00"
                                        input={seconds}
                                        onChangeFunction={(e) => handleNumericInput(e, setSeconds, 59)}
                                        onBlur={validateInput}
                                        size="small"
                                        className="w-16 text-center"
                                    />
                                </div>
                                <CurrentPositionButton isDocument={isDocument} setPageNumber={setPageNumber} isVideo={isVideo} setHours={setHours} setMinutes={setMinutes} setSeconds={setSeconds} clearValidationError={() => setValidationError("")} />
                            </div>
                            {mediaLength > 0 && (
                                <p className="text-xs text-gray-500">
                                    Video length: {Math.floor(mediaLength / 3600)}:{Math.floor((mediaLength % 3600) / 60).toString().padStart(2, '0')}:{Math.floor(mediaLength % 60).toString().padStart(2, '0')}
                                </p>
                            )}
                        </div>
                    )}
                    
                        {/* Error message display */}
                        {validationError && (
                            <div className="text-red-500 text-sm ">
                                {validationError}
                            </div>
                        )}
                    
                    </div>
                    
                    <div className="flex gap-2 justify-between w-full mt-6 pt-4 border-t border-gray-100">
                        <MyButton 
                            buttonType="secondary" 
                            scale="medium"
                            onClick={() => onOpenChange(false)}
                            className="hover:bg-gray-100 transition-all duration-200"
                        >
                            Cancel
                        </MyButton>
                        <MyButton 
                            buttonType="primary" 
                            scale="medium"
                            onClick={handleSubmit}
                            disable={!isValidInput()}
                            className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            Set {isDocument ? "Page" : "Timestamp"}
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        </div>
    );
}; 