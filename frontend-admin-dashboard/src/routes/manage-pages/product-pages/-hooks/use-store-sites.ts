import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCatalogueTags } from '../../-services/catalogue-service';
import { findStoreSites, type StoreSiteRef } from '../-utils/store-page';

/**
 * The websites whose site cart checks out through this product page (it is
 * their STORE page). Reads the sites list's ['catalogueTags', instituteId]
 * cache, so it rarely costs a request; a null / empty code skips the lookup.
 */
export const useStoreSites = (
    instituteId: string,
    productPageCode: string | null | undefined
): StoreSiteRef[] => {
    const { data: catalogues } = useQuery({
        queryKey: ['catalogueTags', instituteId],
        queryFn: () => getCatalogueTags(instituteId),
        enabled: !!instituteId && !!productPageCode,
        staleTime: 60_000,
    });
    // findStoreSites parses every site's whole catalogue JSON: redo it only
    // when the sites or the code change, not on every parent re-render.
    return useMemo(() => findStoreSites(catalogues, productPageCode), [catalogues, productPageCode]);
};
