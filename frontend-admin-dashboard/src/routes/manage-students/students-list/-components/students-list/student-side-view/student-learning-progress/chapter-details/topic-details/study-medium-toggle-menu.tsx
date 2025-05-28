import { slideType } from './topic-details';

export const StudyMediumToggleMenu = ({
    slideTypeDetails,
    selectedSlideType,
}: {
    slideTypeDetails: slideType;
    selectedSlideType: slideType | null;
}) => {
    return (
        <div
            className={`flex h-10 w-[200px] items-center justify-center gap-[10px] rounded-lg px-4 py-[9px] ${
                selectedSlideType && selectedSlideType.id === slideTypeDetails.id
                    ? 'bg-white text-primary-500'
                    : 'bg-none text-neutral-600'
            }`}
        >
            <div>{slideTypeDetails.name}</div>
            <div
                className={`flex size-6 items-center justify-center rounded-full bg-primary-500 text-caption text-neutral-50`}
            >
                {slideTypeDetails.slides?.length}
            </div>
        </div>
    );
};
