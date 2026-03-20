import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { useState, useEffect, useMemo } from 'react';
import { getSlidesMenuOptions } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-constants/slides-menu-options';
import { DotsThree } from '@phosphor-icons/react';
import { CopyToDialog } from './copy-dialog';
import { MoveToDialog } from './move-dialog';
import { DeleteDialog } from './delete-dialog';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { useRouter } from '@tanstack/react-router';
import { SlideDripConditionDialog } from '@/routes/study-library/courses/course-details/-components/SlideDripConditionDialog';
import { getCourseSettings, saveCourseSettings } from '@/services/course-settings';
import type { DripCondition } from '@/types/course-settings';
import { toast } from 'sonner';
import type { DropdownItem } from '@/components/design-system/utils/types/dropdown-types';

export const SlidesMenuOption = () => {
    const [openDialog, setOpenDialog] = useState<
        'copy' | 'move' | 'delete' | 'drip-conditions' | null
    >(null);
    const [dripConditions, setDripConditions] = useState<DripCondition[]>([]);
    const [loadingDripConditions, setLoadingDripConditions] = useState(false);
    const [dripConditionsEnabled, setDripConditionsEnabled] = useState(true);

    const { activeItem, items } = useContentStore();
    const router = useRouter();
    const searchParams = router.state.location.search;
    const courseId: string = searchParams.courseId || '';
    const slideId: string = activeItem?.id || '';
    const slideName: string = activeItem?.title || 'Slide';

    // Get all slides in the current chapter for prerequisite selection
    const allSlides = items.map((slide) => ({
        id: slide.id,
        heading: slide.title || 'Untitled Slide',
    }));

    // Load course settings to check if drip conditions are enabled
    useEffect(() => {
        const loadDripConditionsSettings = async () => {
            try {
                const settings = await getCourseSettings();
                setDripConditionsEnabled(settings.dripConditions?.enabled !== false);
            } catch (error) {
                console.error('Failed to load drip conditions settings:', error);
                // Default to true on error
                setDripConditionsEnabled(true);
            }
        };
        loadDripConditionsSettings();
    }, []);

    // Filter menu options based on drip conditions setting
    const menuOptions = useMemo<DropdownItem[]>(() => {
        const baseOptions = getSlidesMenuOptions();
        if (!dripConditionsEnabled) {
            return baseOptions.filter((item) => item.value !== 'drip-conditions');
        }
        return baseOptions;
    }, [dripConditionsEnabled]);

    const handleSelect = async (value: string) => {
        switch (value) {
            case 'copy':
                setOpenDialog('copy');
                break;
            case 'move':
                setOpenDialog('move');
                break;
            case 'delete':
                setOpenDialog('delete');
                break;
            case 'drip-conditions':
                await loadDripConditions();
                setOpenDialog('drip-conditions');
                break;
        }
    };

    const loadDripConditions = async () => {
        try {
            setLoadingDripConditions(true);
            const settings = await getCourseSettings();
            setDripConditions(settings.dripConditions.conditions || []);
        } catch (error) {
            console.error('Failed to load drip conditions:', error);
            toast.error('Failed to load drip conditions');
            setDripConditions([]);
        } finally {
            setLoadingDripConditions(false);
        }
    };

    const handleSaveDripConditions = async (updatedConditions: DripCondition[]) => {
        try {
            const settings = await getCourseSettings();
            const updatedSettings = {
                ...settings,
                dripConditions: {
                    ...settings.dripConditions,
                    conditions: updatedConditions,
                },
            };
            await saveCourseSettings(updatedSettings);
            setDripConditions(updatedConditions);
            toast.success('Drip conditions saved successfully');
        } catch (error) {
            console.error('Failed to save drip conditions:', error);
            toast.error('Failed to save drip conditions');
            throw error;
        }
    };

    return (
        <>
            <MyDropdown dropdownList={menuOptions} onSelect={handleSelect}>
                <MyButton buttonType="secondary" scale="large" layoutVariant="icon">
                    <DotsThree />
                </MyButton>
            </MyDropdown>

            {/* Copy Dialog */}
            <CopyToDialog openDialog={openDialog} setOpenDialog={setOpenDialog} />

            {/* Move Dialog */}
            <MoveToDialog openDialog={openDialog} setOpenDialog={setOpenDialog} />

            {/* Delete Dialog */}
            <DeleteDialog openDialog={openDialog} setOpenDialog={setOpenDialog} />

            {/* Drip Conditions Dialog */}
            {!loadingDripConditions && (
                <SlideDripConditionDialog
                    open={openDialog === 'drip-conditions'}
                    onClose={() => setOpenDialog(null)}
                    slideId={slideId}
                    slideName={slideName}
                    packageId={courseId}
                    dripConditions={dripConditions}
                    onSave={handleSaveDripConditions}
                    allSlides={allSlides}
                />
            )}
        </>
    );
};
