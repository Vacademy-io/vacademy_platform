import { useEffect, useRef, useState, useCallback } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { Slide, ScormSlide } from '@/hooks/study-library/use-slides';
import { getPackageSessionId } from '@/utils/study-library/get-list-from-stores/getPackageSessionId';

// SCORM Tracking endpoints
const SCORM_TRACKING_BASE = `${BASE_URL}/admin-core-service/scorm/tracking/v1`;

interface ScormTrackingData {
    [key: string]: string;
}

/** Matches the backend ScormTrackingDTO exactly */
interface ScormTrackingCommitPayload {
    scorm_slide_id: string;
    package_session_id: string;
    cmi_suspend_data?: string | null;
    cmi_location?: string | null;
    cmi_exit?: string | null;
    completion_status?: string | null;
    success_status?: string | null;
    score_raw?: number | null;
    score_min?: number | null;
    score_max?: number | null;
    total_time?: string | null;
    cmi_json?: Record<string, string> | null;
}

interface ScormSlideComponentProps {
    slide: Slide;
    packageSessionId?: string;
}

const ScormSlideComponent = ({
    slide,
    packageSessionId: propPackageSessionId = '',
}: ScormSlideComponentProps) => {
    const [launchUrl, setLaunchUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resolvedPackageSessionId, setResolvedPackageSessionId] = useState<string>(
        propPackageSessionId
    );
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const cmiDataRef = useRef<ScormTrackingData>({});
    const { getPublicUrl } = useFileUpload();

    const scormSlide = slide.scorm_slide as ScormSlide | undefined;

    // Fetch packageSessionId if not provided
    useEffect(() => {
        if (!propPackageSessionId) {
            getPackageSessionId().then((id) => {
                if (id) setResolvedPackageSessionId(id);
            });
        }
    }, [propPackageSessionId]);

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
                `${SCORM_TRACKING_BASE}/${slide.id}/initialize?packageSessionId=${resolvedPackageSessionId}`
            );
            cmiDataRef.current = response.data || {};
        } catch (err) {
            console.warn(
                'SCORM tracking initialization failed (may be first launch):',
                err
            );
            cmiDataRef.current = {};
        }
    }, [slide.id, resolvedPackageSessionId]);

    // Commit tracking data to backend
    // NOTE: Both initialize and commit MUST use slide.id (the parent Slide entity's ID)
    // because scorm_learner_progress is indexed by slide_id (not scorm_slide.id)
    const commitScormData = useCallback(async () => {
        if (!slide.id) return;

        const cmi = cmiDataRef.current;

        // Map well-known SCORM 1.2 keys to typed DTO fields.
        // All remaining raw cmi.* keys go into cmi_json for backend storage.
        const knownFields: ScormTrackingCommitPayload = {
            scorm_slide_id: scormSlide?.id || '',
            package_session_id: resolvedPackageSessionId,
            cmi_location: cmi['cmi.core.lesson_location'] ?? cmi['cmi.location'] ?? null,
            cmi_exit:     cmi['cmi.core.exit']            ?? cmi['cmi.exit']     ?? null,
            cmi_suspend_data: cmi['cmi.suspend_data']    ?? null,
            completion_status: cmi['cmi.completion_status']
                ?? cmi['cmi.core.lesson_status']
                ?? null,
            success_status: cmi['cmi.success_status'] ?? null,
            score_raw: cmi['cmi.core.score.raw']  != null ? Number(cmi['cmi.core.score.raw'])  : null,
            score_min: cmi['cmi.core.score.min']  != null ? Number(cmi['cmi.core.score.min'])  : null,
            score_max: cmi['cmi.core.score.max']  != null ? Number(cmi['cmi.core.score.max'])  : null,
            total_time: cmi['cmi.core.session_time'] ?? cmi['cmi.session_time'] ?? null,
            // Store EVERYTHING as cmi_json for full fidelity
            cmi_json: Object.keys(cmi).length > 0 ? cmi : null,
        };

        console.log('[SCORM] Committing to slide.id:', slide.id, '| payload:', knownFields);

        try {
            await authenticatedAxiosInstance.post(
                // Use slide.id — same ID used in /initialize — so the backend
                // findTopByUserIdAndSlideId query matches the initialized session.
                `${SCORM_TRACKING_BASE}/${slide.id}/commit`,
                knownFields
            );
            console.log('[SCORM] Commit successful');
        } catch (err) {
            console.error('SCORM commit failed:', err);
        }
    }, [scormSlide?.id, slide.id, resolvedPackageSessionId]);

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
        <div
            className="relative w-full"
            style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}
        >
            <iframe
                ref={iframeRef}
                src={launchUrl}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={slide.title || 'SCORM Content'}
                allow="fullscreen"
                onLoad={() => {
                    console.log('[SCORM] iframe loaded, sending init data');
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
