import React, { useState, useCallback, useEffect, useRef } from 'react';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { addEmailAsset, getEmailAssets, EmailAsset } from '@/services/email-assets-service';
import { getUserId } from '@/utils/userDetails';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export interface AssetImage {
    id: string;
    name: string;
    url: string;
    thumbnail: string;
    category: string;
    description?: string;
    createdAt?: string;
    createdBy?: string;
}

interface AssetPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (imageUrl: string) => void;
}

// Transform API response to AssetImage format
const transformEmailAssetToAssetImage = (asset: EmailAsset): AssetImage => ({
    id: asset.id,
    name: asset.name,
    url: asset.data,
    thumbnail: asset.data, // Use the same URL for thumbnail
    category: 'Email Assets',
    description: asset.description,
    createdAt: asset.created_at_iso,
    createdBy: asset.created_by,
});

const AssetPicker: React.FC<AssetPickerProps> = ({ isOpen, onClose, onSelect }) => {
    const [assets, setAssets] = useState<AssetImage[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Track request ID to handle race conditions
    const requestIdRef = useRef<number>(0);
    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef<boolean>(true);

    // Reset state when modal opens and load assets
    useEffect(() => {
        if (isOpen) {
            // Reset filters when modal opens to ensure all assets are shown
            setSearchQuery('');
            setSelectedCategory('All');
            setError(null);
            loadAssets();
        }
        
        // Cleanup function - increment request ID to invalidate any pending requests
        return () => {
            requestIdRef.current += 1;
        };
    }, [isOpen]);

    // Track mounted state
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const loadAssets = async () => {
        // Increment request ID to track this specific request
        const currentRequestId = ++requestIdRef.current;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const emailAssets = await getEmailAssets();
            
            // Only update state if this is still the latest request and component is mounted
            if (currentRequestId === requestIdRef.current && isMountedRef.current) {
                const transformedAssets = emailAssets.map(transformEmailAssetToAssetImage);
                console.log('Loaded assets:', transformedAssets.length, 'for request:', currentRequestId);
                setAssets(transformedAssets);
            } else {
                console.log('Discarding stale response for request:', currentRequestId, 'current:', requestIdRef.current);
            }
        } catch (err) {
            // Only update error state if this is still the latest request
            if (currentRequestId === requestIdRef.current && isMountedRef.current) {
                console.error('Failed to load email assets:', err);
                setError(err instanceof Error ? err.message : 'Failed to load assets');
                toast.error('Failed to load assets. Please try again.');
            }
        } finally {
            // Only update loading state if this is still the latest request
            if (currentRequestId === requestIdRef.current && isMountedRef.current) {
                setIsLoading(false);
            }
        }
    };

    // Get all categories
    const categories = ['All', ...new Set(assets.map((a) => a.category))];

    // Filter assets based on category and search
    const filteredAssets = assets.filter((asset) => {
        const matchesCategory = selectedCategory === 'All' || asset.category === selectedCategory;
        const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Handle file upload
    const handleUpload = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            setIsUploading(true);

            const userId = getUserId();
            const instituteId = getInstituteId();

            if (!userId || !instituteId) {
                toast.error('Missing user credentials. Please refresh and try again.');
                setIsUploading(false);
                return;
            }

            const newAssets: AssetImage[] = [];

            try {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (!file || !file.type.startsWith('image/')) continue;

                    // Upload to S3
                    const fileId = await UploadFileInS3(
                        file,
                        () => {},
                        userId,
                        'EMAIL_TEMPLATES',
                        instituteId,
                        true // Get public URL
                    );

                    if (!fileId) {
                        console.error('Failed to upload file:', file.name);
                        toast.error(`Failed to upload ${file.name}`);
                        continue;
                    }

                    const publicUrl = await getPublicUrl(fileId);
                    if (!publicUrl) {
                        console.error('Failed to get public URL for file:', file.name);
                        toast.error(`Failed to get URL for ${file.name}`);
                        continue;
                    }

                    // Save asset to API (system files)
                    const assetName = file.name.replace(/\.[^/.]+$/, '');
                    try {
                        const result = await addEmailAsset(publicUrl, assetName, `Uploaded on ${new Date().toLocaleDateString()}`);
                        
                        const newAsset: AssetImage = {
                            id: result.id,
                            name: assetName,
                            url: publicUrl,
                            thumbnail: publicUrl,
                            category: 'Email Assets',
                        };

                        newAssets.push(newAsset);
                    } catch (apiError) {
                        console.error('Failed to save asset to API:', apiError);
                        toast.error(`Failed to save ${file.name} to library`);
                    }
                }

                // Update local state with new assets
                if (newAssets.length > 0) {
                    setAssets((prev) => [...prev, ...newAssets]);
                    toast.success(`${newAssets.length} image${newAssets.length > 1 ? 's' : ''} uploaded successfully!`);
                }
            } catch (error) {
                console.error('Error uploading files:', error);
                toast.error('Failed to upload some images. Please try again.');
            } finally {
                setIsUploading(false);
                event.target.value = '';
            }
        },
        []
    );

    // Handle image selection
    const handleSelect = useCallback(
        (imageUrl: string) => {
            onSelect(imageUrl);
            onClose();
        },
        [onSelect, onClose]
    );

    // Handle refresh - reset filters and reload
    const handleRefresh = useCallback(() => {
        setSearchQuery('');
        setSelectedCategory('All');
        loadAssets();
    }, []);

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <h2 style={styles.title}>📁 Institute Email Assets</h2>
                    <div style={styles.headerActions}>
                        <button 
                            style={styles.refreshButton} 
                            onClick={handleRefresh}
                            disabled={isLoading}
                            title="Refresh assets"
                        >
                            🔄
                        </button>
                        <button style={styles.closeButton} onClick={onClose}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div style={styles.toolbar}>
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search images..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={styles.searchInput}
                    />

                    {/* Category filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        style={styles.categorySelect}
                    >
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>

                    {/* Upload button */}
                    <label style={{
                        ...styles.uploadButton,
                        opacity: isUploading ? 0.7 : 1,
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                    }}>
                        {isUploading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            '📤 Upload Image'
                        )}
                        <input
                            type="file"
                            accept="image/*,.gif"
                            multiple
                            onChange={handleUpload}
                            style={{ display: 'none' }}
                            disabled={isUploading}
                        />
                    </label>
                </div>

                {/* Info banner */}
                <div style={styles.infoBanner}>
                    <span style={styles.infoIcon}>ℹ️</span>
                    <span>Assets are shared across all email templates in your institute. Upload once, use everywhere!</span>
                </div>

                {/* Image grid */}
                <div style={styles.imageGrid}>
                    {isLoading ? (
                        <div style={styles.loadingState}>
                            <Loader2 className="size-8 animate-spin" style={{ color: '#667eea' }} />
                            <p>Loading assets...</p>
                        </div>
                    ) : error ? (
                        <div style={styles.errorState}>
                            <p>❌ {error}</p>
                            <button style={styles.retryButton} onClick={handleRefresh}>
                                Try Again
                            </button>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}>🖼️</div>
                            <p style={styles.emptyTitle}>No images found</p>
                            <p style={styles.emptySubtitle}>
                                {searchQuery 
                                    ? 'Try adjusting your search query'
                                    : 'Upload some images to build your asset library!'}
                            </p>
                        </div>
                    ) : (
                        filteredAssets.map((asset) => (
                            <div
                                key={asset.id}
                                style={styles.imageCard}
                                onClick={() => handleSelect(asset.url)}
                            >
                                <div style={styles.imageWrapper}>
                                    <img 
                                        src={asset.thumbnail} 
                                        alt={asset.name} 
                                        style={styles.image}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999">Error</text></svg>';
                                        }}
                                    />
                                </div>
                                <div style={styles.imageName} title={asset.name}>{asset.name}</div>
                                <div style={styles.imageCategory}>{asset.category}</div>
                                {asset.createdBy && (
                                    <div style={styles.imageCreator}>by {asset.createdBy}</div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer with asset count */}
                <div style={styles.footer}>
                    <span>{filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} available</span>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '900px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px',
        borderBottom: '1px solid #eee',
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    title: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 600,
        color: '#333',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        color: '#666',
        padding: '4px 8px',
        borderRadius: '4px',
    },
    refreshButton: {
        background: '#f1f5f9',
        border: 'none',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '6px 10px',
        borderRadius: '6px',
        transition: 'background-color 0.2s',
    },
    toolbar: {
        display: 'flex',
        gap: '12px',
        padding: '16px 24px',
        borderBottom: '1px solid #eee',
        flexWrap: 'wrap',
    },
    searchInput: {
        flex: 1,
        minWidth: '200px',
        padding: '10px 14px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
    },
    categorySelect: {
        padding: '10px 14px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        fontSize: '14px',
        backgroundColor: '#fff',
        cursor: 'pointer',
        outline: 'none',
    },
    uploadButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 18px',
        backgroundColor: '#667eea',
        color: '#fff',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    infoBanner: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 24px',
        backgroundColor: '#f0f9ff',
        color: '#0369a1',
        fontSize: '13px',
        borderBottom: '1px solid #e0f2fe',
    },
    infoIcon: {
        fontSize: '14px',
    },
    imageGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '16px',
        padding: '24px',
        overflowY: 'auto',
        flex: 1,
        minHeight: '300px',
    },
    imageCard: {
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        border: '2px solid transparent',
        padding: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backgroundColor: '#f8f9fa',
    },
    imageWrapper: {
        position: 'relative',
        paddingTop: '75%',
        overflow: 'hidden',
        borderRadius: '6px',
        backgroundColor: '#eee',
    },
    image: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    imageName: {
        marginTop: '8px',
        fontSize: '13px',
        fontWeight: 500,
        color: '#333',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    imageCategory: {
        fontSize: '11px',
        color: '#888',
        marginTop: '2px',
    },
    imageCreator: {
        fontSize: '10px',
        color: '#aaa',
        marginTop: '2px',
        fontStyle: 'italic',
    },
    loadingState: {
        gridColumn: '1 / -1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: '#666',
        gap: '12px',
    },
    errorState: {
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '60px 20px',
        color: '#dc2626',
    },
    retryButton: {
        marginTop: '16px',
        padding: '8px 16px',
        backgroundColor: '#667eea',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    emptyState: {
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '60px 20px',
        color: '#888',
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    emptyTitle: {
        fontSize: '16px',
        fontWeight: 600,
        color: '#333',
        margin: '0 0 8px 0',
    },
    emptySubtitle: {
        fontSize: '14px',
        color: '#666',
        margin: 0,
    },
    footer: {
        padding: '12px 24px',
        borderTop: '1px solid #eee',
        fontSize: '13px',
        color: '#666',
        textAlign: 'right',
    },
};

export default AssetPicker;
