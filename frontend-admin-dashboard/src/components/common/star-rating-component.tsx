import { Star, StarHalf } from "phosphor-react";

interface StarRatingProps {
    score: number;
    maxScore?: number;
}

export const StarRatingComponent = ({ score, maxScore = 100 }: StarRatingProps) => {
    const maxStars = 5;
    const starValue = (score / maxScore) * maxStars;
    const fullStars = Math.floor(starValue);
    const hasHalfStar = starValue - fullStars >= 0.5;
    const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);

    return (
        <div className="flex items-center gap-1">
            {/* Full Stars */}
            {Array.from({ length: fullStars }).map((_, i) => (
                <Star
                    key={`full-${i}`}
                    className="size-5 fill-yellow-500 text-yellow-500"
                    weight="fill"
                />
            ))}

            {/* Half Star */}
            {hasHalfStar && <StarHalf weight="fill" className="size-5 text-yellow-500" />}

            {/* Empty Stars — render only if there's any */}
            {emptyStars > 0 &&
                Array.from({ length: emptyStars }).map((_, i) => (
                    <Star key={`empty-${i}`} className="size-5 text-gray-300" />
                ))}
        </div>
    );
};
