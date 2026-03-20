import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StarFour } from '@phosphor-icons/react';
import { GetImagesForAITools } from '../-helpers/GetImagesForAITools';
import { AIToolFeatureType } from '../-constants/AICardsData';
import { useNavigate } from '@tanstack/react-router';

export const AIToolsCard = ({ feature }: { feature: AIToolFeatureType }) => {
    const navigate = useNavigate();
    return (
        <Card
            key={feature.key}
            className="group flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden border-neutral-200 bg-white transition-all hover:border-primary-200 hover:shadow-lg"
            onClick={() => {
                if (feature.route) {
                    navigate({ to: feature.route });
                }
            }}
        >
            <CardHeader className="flex flex-col gap-2 p-5 pb-0">
                <div className="flex items-center gap-2">
                    <div className="flex bg-primary-50 p-2 rounded-lg text-primary-500 group-hover:bg-primary-100 transition-colors">
                        <StarFour weight="fill" className="size-5" />
                    </div>
                    <CardTitle className="text-base font-semibold text-gray-900 line-clamp-1">
                        {feature.heading}
                    </CardTitle>
                </div>

                <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">
                        {feature.subheading}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                        {feature.tags.map((tag, index) => (
                            <span
                                key={index}
                                className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/10"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex justify-end p-4 pt-2">
                <div className="h-24 w-auto opacity-80 duration-300 group-hover:scale-105 group-hover:opacity-100 [&_svg]:h-full [&_svg]:w-auto">
                    {GetImagesForAITools(feature.key)}
                </div>
            </CardContent>
        </Card>
    );
};
