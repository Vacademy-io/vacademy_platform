import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createFileRoute } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { AICenterProvider } from './-contexts/useAICenterContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Removed unused imports AIToolCardDataType and AIToolFeatureType
import { AIToolCardData } from './-constants/AICardsData';
import { AIToolsCard } from './-components/AIToolsCard';

export const Route = createFileRoute('/ai-center/')({
    component: () => (
        <LayoutContainer>
            <AICenterProvider>
                <RouteComponent />
            </AICenterProvider>
        </LayoutContainer>
    ),
});

const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
};

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('VSmart AI Tools');
    }, [setNavHeading]);

    const handleTabChange = (value: string) => {
        const element = document.getElementById(value);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Corrected line to avoid TS2532 error (already correct)
    const firstCategoryTitle = AIToolCardData[0]?.title;
    const defaultTabValue = firstCategoryTitle ? slugify(firstCategoryTitle) : '';

    const navBarHeightClass = 'top-16';
    const sectionScrollMarginTopClass = 'scroll-mt-32';

    return (
        <Tabs
            defaultValue={defaultTabValue}
            onValueChange={handleTabChange}
            className="flex w-full flex-col items-start gap-4"
        >
            <TabsList
                className={`sticky ${navBarHeightClass} z-40 mb-4 w-full self-start rounded-lg bg-white p-1.5 shadow-sm md:w-auto`}
            >
                {AIToolCardData.map((category) => (
                    <TabsTrigger
                        key={slugify(category.title)}
                        value={slugify(category.title)}
                        className="h-10 w-full rounded-md px-3 py-1.5 text-sm font-medium hover:cursor-pointer data-[state=active]:bg-primary-50 data-[state=active]:text-primary-500 sm:w-[200px]"
                    >
                        {category.title}
                    </TabsTrigger>
                ))}
            </TabsList>

            <div className="flex w-full flex-col gap-4">
                {AIToolCardData.map((category) => (
                    <section
                        key={slugify(category.title)}
                        id={slugify(category.title)}
                        className={`flex w-full flex-col gap-6 ${sectionScrollMarginTopClass}`}
                    >
                        <h2 className="border-b pb-3 text-2xl font-semibold text-gray-800">
                            {category.title}
                        </h2>
                        <div className="flex w-full flex-col gap-6">
                            {category.features.map((feature) => (
                                <AIToolsCard key={feature.key} feature={feature} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </Tabs>
    );
}
