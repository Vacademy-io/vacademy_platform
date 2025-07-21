// Types for ReviewItem component
export interface User {
    id: string;
    username: string;
    email: string;
    full_name: string;
    profile_pic_file_id: string | null;
}

export interface Rating {
    id: string;
    points: number;
    likes: number;
    dislikes: number;
    text: string;
    user: User;
    created_at: string;
}

export interface Review {
    id: string;
    user: {
        name: string;
        avatarUrl: string;
    };
    createdAt: string;
    rating: number;
    description: string;
    likes: number;
    dislikes: number;
}

export interface ReviewItemProps {
    review: Review;
    avatarUrl?: string;
    onLike: (reviewId: string) => void;
    onDislike: (reviewId: string) => void;
    onDelete: (reviewId: string) => void;
    showActions?: boolean;
    variant?: 'default' | 'compact';
} 