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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-primary-500">
                        {isDocument ? "Set Page Number" : "Set Timestamp"}
                    </DialogTitle>
                </DialogHeader>
                
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
                
                <div className="flex gap-2 justify-between w-full">
                    <MyButton 
                        buttonType="secondary" 
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton 
                        buttonType="primary" 
                        scale="medium"
                        onClick={handleSubmit}
                        disable={!isValidInput()}
                    >
                        Set {isDocument ? "Page" : "Timestamp"}
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}; 