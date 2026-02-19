import { useEffect, useRef, useState, useCallback } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { Slide, ScormSlide } from '@/hooks/study-library/use-slides';

// SCORM Tracking endpoints
const SCORM_TRACKING_INITIALIZE = `${BASE_URL}/admin-core-service/scorm/tracking/v1`;
const SCORM_TRACKING_COMMIT = `${BASE_URL}/admin-core-service/scorm/tracking/v1/commit`;

interface ScormTrackingData {
    [key: string]: string;
}

interface ScormSlideComponentProps {
    slide: Slide;
    packageSessionId?: string;
}

const ScormSlideComponent = ({
    slide,
    packageSessionId = '',
}: ScormSlideComponentProps) => {
    const [launchUrl, setLaunchUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const cmiDataRef = useRef<ScormTrackingData>({});
    const { getPublicUrl } = useFileUpload();

    const scormSlide = slide.scorm_slide as ScormSlide | undefined;

    // Reset state when switching slides
    useEffect(() => {
        setLaunchUrl('');
        setIsLoading(true);
        setError(null);
    }, [slide.id]);

    // Initialize tracking data from backend
    const initializeScormTracking = useCallback(async () => {
        if (!slide.id) return;

        try {
            const response = await authenticatedAxiosInstance.get(
                `${SCORM_TRACKING_INITIALIZE}/${slide.id}/initialize?packageSessionId=${packageSessionId}`
            );
            cmiDataRef.current = response.data || {};
        } catch (err) {
            console.warn(
                'SCORM tracking initialization failed (may be first launch):',
                err
            );
            cmiDataRef.current = {};
        }
    }, [slide.id, packageSessionId]);

    // Commit tracking data to backend
    const commitScormData = useCallback(async () => {
        if (!scormSlide?.id) return;

        try {
            await authenticatedAxiosInstance.post(SCORM_TRACKING_COMMIT, {
                scorm_slide_id: scormSlide.id,
                package_session_id: packageSessionId,
                ...cmiDataRef.current,
            });
        } catch (err) {
            console.error('SCORM commit failed:', err);
        }
    }, [scormSlide?.id, packageSessionId]);

    // Listen for postMessage events from the SCORM wrapper on S3
    useEffect(() => {
        const handleScormMessage = (event: MessageEvent) => {
            if (!event.data || event.data.type !== 'vacademy_scorm') return;

            const { action, key, value } = event.data;

            switch (action) {
                case 'LMSInitialize':
                case 'Initialize':
                    console.log(`[SCORM Bridge] ${action}`);
                    break;
                case 'LMSSetValue':
                case 'SetValue':
                    console.log(
                        `[SCORM Bridge] ${action}("${key}", "${value}")`
                    );
                    cmiDataRef.current[key] = value;
                    break;
                case 'LMSGetValue':
                case 'GetValue':
                    console.log(
                        `[SCORM Bridge] ${action}("${key}") = "${value}"`
                    );
                    break;
                case 'LMSCommit':
                case 'Commit':
                    console.log('[SCORM Bridge] Commit');
                    commitScormData();
                    break;
                case 'LMSFinish':
                case 'Terminate':
                    console.log(`[SCORM Bridge] ${action}`);
                    commitScormData();
                    break;
            }
        };

        window.addEventListener('message', handleScormMessage);
        return () => window.removeEventListener('message', handleScormMessage);
    }, [commitScormData]);

    // Resolve the launch URL
    useEffect(() => {
        const fetchLaunchUrl = async () => {
            if (!scormSlide) {
                setError('SCORM slide data not found');
                setIsLoading(false);
                return;
            }

            try {
                // Initialize tracking data
                await initializeScormTracking();

                if (scormSlide.launch_url) {
                    const url = await getPublicUrl(scormSlide.launch_url);
                    setLaunchUrl(url);
                } else if (scormSlide.launch_path?.startsWith('http')) {
                    setLaunchUrl(scormSlide.launch_path);
                } else if (
                    scormSlide.original_file_id &&
                    scormSlide.launch_path
                ) {
                    const fullFileId = `${scormSlide.original_file_id}/${scormSlide.launch_path}`;
                    const url = await getPublicUrl(fullFileId);
                    setLaunchUrl(url);
                } else {
                    setError('SCORM launch path is not configured');
                }
            } catch (err) {
                console.error('Error resolving SCORM launch URL:', err);
                setError('Failed to load SCORM content');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLaunchUrl();
    }, [scormSlide, initializeScormTracking, getPublicUrl]);

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500"></div>
                    <p className="text-sm text-neutral-500">
                        Loading SCORM content...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                        <svg
                            className="h-7 w-7 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    if (!launchUrl) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-neutral-500">
                    SCORM content URL not available
                </p>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full" style={{ minHeight: '600px' }}>
            <iframe
                ref={iframeRef}
                src={launchUrl}
                className="h-full w-full border-0"
                title={slide.title || 'SCORM Content'}
                allow="fullscreen"
                onLoad={() => {
                    // Send saved tracking data to the wrapper for resume
                    if (iframeRef.current?.contentWindow) {
                        iframeRef.current.contentWindow.postMessage(
                            {
                                type: 'vacademy_scorm_init',
                                cmiData: cmiDataRef.current,
                            },
                            '*'
                        );
                    }
                }}
            />
        </div>
    );
};

export default ScormSlideComponent;
