
import { createLazyFileRoute } from '@tanstack/react-router';
import { AICenterProvider } from '../-contexts/useAICenterContext';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { AIToolCardData } from '../-constants/AICardsData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIToolsCard } from '../-components/AIToolsCard';

const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
};

export const Route = createLazyFileRoute('/ai-center/ai-tools/')({
    component: () => (
        <LayoutContainer>
            <AICenterProvider>
                <RouteComponent />
            </AICenterProvider>
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    // Corrected line to avoid TS2532 error (already correct)
    const firstCategoryTitle = AIToolCardData[0]?.title;
    const defaultTabValue = firstCategoryTitle ? slugify(firstCategoryTitle) : '';

    const navBarHeightClass = 'top-16';

    useEffect(() => {
        setNavHeading('VSmart AI Tools');
    }, [setNavHeading]);

    return (
        <>
            <Tabs
                defaultValue={defaultTabValue}
                className="flex w-full flex-col items-start gap-4"
            >
                <TabsList
                    className={`no-scrollbar sticky ${navBarHeightClass} z-40 mb-4 flex w-full gap-1 self-start overflow-x-auto rounded-lg bg-white p-1.5 shadow-sm sm:inline-flex sm:w-auto`}
                >
                    {AIToolCardData.map((category) => (
                        <TabsTrigger
                            key={slugify(category.title)}
                            value={slugify(category.title)}
                            className="h-9 w-auto shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium hover:cursor-pointer data-[state=active]:bg-primary-50 data-[state=active]:text-primary-500 sm:h-10 sm:w-[200px] sm:text-sm"
                        >
                            {category.title}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {AIToolCardData.map((category) => (
                    <TabsContent
                        key={slugify(category.title)}
                        value={slugify(category.title)}
                        className="w-full"
                    >
                        <div className="flex flex-col gap-6">
                            <h2 className="text-xl font-semibold text-gray-800">
                                {category.title}
                            </h2>
                            <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {category.features.map((feature) => (
                                    <AIToolsCard key={feature.key} feature={feature} />
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </>
    );
}
