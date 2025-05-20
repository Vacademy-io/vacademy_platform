import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StarFour } from 'phosphor-react';
import { GetImagesForAITools } from '../-helpers/GetImagesForAITools';
import { AIToolFeatureType } from '../-constants/AICardsData';
import { useNavigate } from '@tanstack/react-router';

export const AIToolsCard = ({ feature }: { feature: AIToolFeatureType }) => {
    const navigate = useNavigate();
    return (
        <Card
            key={feature.key}
            className="flex w-full cursor-pointer items-center justify-center gap-10 border-neutral-300 bg-neutral-50 p-8 text-neutral-600 sm:flex-wrap md:flex-nowrap"
            onClick={() => {
                if (feature.route) {
                    navigate({ to: feature.route });
                }
            }}
        >
            <CardHeader className="flex h-fit flex-col gap-3">
                <CardTitle className="flex items-center gap-2 text-title font-semibold">
                    <StarFour size={30} weight="fill" className="text-primary-500" />{' '}
                    {feature.heading}
                    <p className="text-body">({feature.subheading})</p>
                </CardTitle>
                <CardDescription className="flex flex-col justify-between">
                    <div className="flex flex-col gap-3">
                        {feature.description.map((description, index) => (
                            <p key={index}>{description}</p>
                        ))}
                    </div>
                </CardDescription>
            </CardHeader>
            <CardContent>{GetImagesForAITools(feature.key)}</CardContent>
        </Card>
    );
};
