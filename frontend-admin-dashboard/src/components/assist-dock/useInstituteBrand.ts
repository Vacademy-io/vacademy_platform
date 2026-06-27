import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInstituteId } from '@/constants/helper';
import { fetchInstituteDetailsById } from '@/lib/auth/instituteService';
import { getPublicUrl } from '@/services/upload_file';

export interface InstituteBrand {
    name: string;
    logoUrl: string;
    /** Hex like #1B73E8, used to re-tint the walkthrough player chrome. */
    themeColor: string;
    /** Portal host shown in the walkthrough's mock address bar. */
    url: string;
}

/**
 * The current institute's branding, for injecting into a walkthrough player
 * (name + logo + accent color + portal URL). Best-effort: any field may be
 * empty while loading or if the institute hasn't set it.
 */
export function useInstituteBrand(): InstituteBrand {
    const instituteId = getInstituteId();

    const { data } = useQuery({
        queryKey: ['assist-institute-brand', instituteId],
        queryFn: () => fetchInstituteDetailsById(instituteId as string),
        enabled: !!instituteId,
        staleTime: 10 * 60 * 1000,
    });

    const logoFileId = data?.institute_logo_file_id ?? null;
    const { data: logoUrl } = useQuery({
        queryKey: ['assist-institute-logo', logoFileId],
        queryFn: () => getPublicUrl(logoFileId),
        enabled: !!logoFileId,
        staleTime: 30 * 60 * 1000,
    });

    const name = data?.institute_name ?? '';
    const themeColor = data?.institute_theme_code ?? '';
    // Stable identity while the underlying fields are unchanged, so consumers can
    // safely depend on the whole object in effect deps.
    return useMemo<InstituteBrand>(
        () => ({
            name,
            logoUrl: logoUrl ?? '',
            themeColor,
            url: typeof window !== 'undefined' ? window.location.host : '',
        }),
        [name, logoUrl, themeColor]
    );
}
