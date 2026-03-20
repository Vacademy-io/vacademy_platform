import { useState, useEffect, useRef } from 'react';
import { YooptaPlugin, useYooptaEditor, Elements, PluginElementRenderProps } from '@yoopta/editor';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export function AudioPlayerBlock({ element, attributes, children, blockId }: PluginElementRenderProps) {
    const editor = useYooptaEditor();
    const [audioUrl, setAudioUrl] = useState(element?.props?.audioUrl || '');
    const [title, setTitle] = useState(element?.props?.title || '');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isFirstRender = useRef(true);

    // Persist state to Yoopta/Slate store
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        Elements.updateElement(editor, blockId, {
            type: 'audioPlayer',
            props: {
                ...element.props,
                audioUrl,
                title,
                editorType: 'audioPlayer',
            },
        });
    }, [audioUrl, title]);

    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('audio/')) {
            alert('Please select an audio file');
            return;
        }

        setIsUploading(true);

        try {
            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            const data = getTokenDecodedData(accessToken);
            const instituteId = data && Object.keys(data.authorities)[0];
            const userId = data?.sub || 'unknown-user';

            const fileId = await UploadFileInS3(
                file,
                () => {},
                userId,
                instituteId,
                'STUDENTS',
                true
            );

            if (!fileId) throw new Error('Upload failed');

            const publicUrl = await getPublicUrl(fileId);
            if (!publicUrl) throw new Error('Failed to get URL');

            setAudioUrl(publicUrl);
            if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
        } catch (error) {
            console.error('Audio upload failed:', error);
            alert('Failed to upload audio file');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            const target = e.target as HTMLInputElement;
            if (target.value.length > 0 || target.selectionStart !== 0) {
                e.stopPropagation();
            }
        }
    };

    return (
        <div
            {...attributes}
            contentEditable={false}
            style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                margin: '8px 0',
                overflow: 'hidden',
                backgroundColor: '#fafafa',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#f0f0f0',
                    borderBottom: '1px solid #e0e0e0',
                }}
            >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                    Audio Player
                </span>
                {audioUrl && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            padding: '3px 10px',
                            fontSize: '12px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            color: '#666',
                            cursor: 'pointer',
                        }}
                    >
                        Replace
                    </button>
                )}
            </div>

            <div style={{ padding: '12px' }}>
                {!audioUrl ? (
                    /* Upload area */
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        style={{
                            border: '2px dashed #ccc',
                            borderRadius: '6px',
                            padding: '32px',
                            textAlign: 'center',
                            cursor: isUploading ? 'wait' : 'pointer',
                            backgroundColor: '#fff',
                        }}
                    >
                        {isUploading ? (
                            <div style={{ fontSize: '14px', color: '#666' }}>
                                Uploading...
                            </div>
                        ) : (
                            <>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                                        <path d="M9 18V5l12-2v13" />
                                        <circle cx="6" cy="18" r="3" />
                                        <circle cx="18" cy="16" r="3" />
                                    </svg>
                                </div>
                                <div style={{ fontSize: '14px', color: '#666' }}>
                                    Click or drag audio file here
                                </div>
                                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                    MP3, WAV, OGG, M4A supported
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    /* Audio player */
                    <div>
                        {/* Title input */}
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            placeholder="Audio title (optional)"
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                marginBottom: '10px',
                                backgroundColor: '#fff',
                            }}
                        />
                        {/* HTML5 audio player */}
                        <audio
                            controls
                            src={audioUrl}
                            style={{ width: '100%', borderRadius: '4px' }}
                            preload="metadata"
                        />
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                }}
            />

            {children}
        </div>
    );
}

// Audio icon for action menu
const AudioIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
);

// Yoopta Plugin Definition
export const AudioPlugin = new YooptaPlugin<{ audioPlayer: any }>({
    type: 'audioPlayer',
    elements: {
        audioPlayer: {
            render: AudioPlayerBlock,
        },
    },
    options: {
        display: {
            title: 'Audio Player',
            description: 'Embed an audio file',
            icon: <AudioIcon />,
        },
        shortcuts: ['audio', 'sound', 'music', 'mp3'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    if (element.getAttribute?.('data-yoopta-type') !== 'audioPlayer') {
                        return undefined;
                    }
                    const title = element.getAttribute('data-title') || '';
                    const audioEl = element.querySelector?.('audio');
                    const audioUrl = audioEl?.getAttribute('src') || '';
                    return {
                        id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'audioPlayer',
                        props: { audioUrl, title, editorType: 'audioPlayer' },
                        children: [{ text: '' }],
                    };
                },
            },
            serialize: (element, _children) => {
                const props = element.props || {};
                const audioUrl = props.audioUrl || '';
                const title = (props.title || '').replace(/"/g, '&quot;');

                if (!audioUrl) {
                    return `<div data-yoopta-type="audioPlayer" data-editor-type="audioPlayer" data-title="${title}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 8px 0; background: #fafafa; text-align: center; color: #999;">No audio uploaded</div>`;
                }

                return `<div data-yoopta-type="audioPlayer" data-editor-type="audioPlayer" data-title="${title}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 8px 0; background: #fafafa;">${title ? `<div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #333;">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}<audio controls src="${audioUrl}" style="width: 100%;" preload="metadata"></audio></div>`;
            },
        },
    },
});
