import { FilterRequestType } from '../-types/enroll-request-types';
import { EmptyRequestPage } from '@/assets/svgs';
import { LearnerRequest } from './learner-request';
import { useGetEnrollRequests } from '../-services/get-enroll-requests';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getInstituteId } from '@/constants/helper';
// import { useQueryClient } from "@tanstack/react-query";
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';

export const EnrollRequests = () => {
    const INSTITUTE_ID = getInstituteId();
    // const queryClient = useQueryClient();

    // Set up the intersection observer reference
    const { ref, inView } = useInView({
        threshold: 0,
        rootMargin: '0px 0px 300px 0px',
    });

    // const [filterRequest, setFilterRequest] = useState<FilterRequestType>({
    //     status: ["ACTIVE", "INACTIVE"],
    //     name: ""
    // })

    const filterRequest: FilterRequestType = {
        status: ['ACTIVE', 'INACTIVE'],
        name: '',
    };

    const {
        data: requestData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        // refetch
    } = useGetEnrollRequests({
        instituteId: INSTITUTE_ID || '',
        pageNo: 0,
        pageSize: 3,
        filterRequest: filterRequest,
    });

    // Load more data when the user scrolls to the bottom
    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage]);

    // Calculate total items across all pages
    //   const totalItems = requestData?.pages.reduce(
    //     (count, page) => count + (page?.numberOfElements || 0), 0
    //   ) || 0;

    if (isLoading) return <DashboardLoader />;
    if (isError) return <p>Error loading enroll requests</p>;

    const isEmpty =
        !requestData ||
        requestData.pages.length === 0 ||
        requestData.pages.every((page) => page?.content?.length === 0);

    return (
        <div className="flex w-full flex-col gap-10 text-neutral-600">
            {isEmpty ? (
                <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2 text-title">
                    <EmptyRequestPage />
                    <p className="font-semibold">No Enrollment Requests Yet!</p>
                    <p>New requests will appear here for your review and approval</p>
                </div>
            ) : (
                <>
                    {requestData.pages.map((page) =>
                        page?.content.map((request, index) => (
                            <LearnerRequest key={index} obj={request} />
                        ))
                    )}

                    {hasNextPage && (
                        <div ref={ref} className="flex justify-center p-4">
                            {isFetchingNextPage ? (
                                <div className="text-sm">Loading more requests...</div>
                            ) : (
                                <div className="text-sm">Scroll to load more</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
