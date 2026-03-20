/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import { getUserId } from '@/utils/userDetails';
import { getUserBasicDetails, UserBasicDetails } from '@/services/get_user_basic_details';
import { useFileUpload } from '@/hooks/use-file-upload';

interface CurrentUser {
    id: string;
    name: string;
    avatarUrl: string | null;
}

export const useCurrentUser = () => {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { getPublicUrl } = useFileUpload();

    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                setIsLoading(true);
                const userId = getUserId();

                if (!userId) {
                    throw new Error('No user ID found');
                }

                // Get user basic details
                const userDetails = await getUserBasicDetails([userId]);

                if (!userDetails || userDetails.length === 0) {
                    throw new Error('User details not found');
                }

                const user = userDetails[0];
                let avatarUrl: string | null = null;

                // Get avatar URL if user has a profile picture
                if (user!.face_file_id) {
                    try {
                        avatarUrl = await getPublicUrl(user!.face_file_id);
                    } catch (avatarError) {
                        console.warn('Failed to load user avatar:', avatarError);
                        // Continue without avatar - will use fallback
                    }
                }

                setCurrentUser({
                    id: user!.id,
                    name: user!.name,
                    avatarUrl,
                });
                setError(null);
            } catch (err) {
                console.error('Failed to fetch current user:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch user data');
                setCurrentUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCurrentUser();
    }, [getPublicUrl]);

    return { currentUser, isLoading, error };
};
