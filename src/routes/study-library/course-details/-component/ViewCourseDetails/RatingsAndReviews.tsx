import React from 'react';
import { ThumbsUp, MessageCircle, Star } from 'lucide-react';

// Single Component with all logic and UI
const RatingsAndReviews: React.FC = () => {
  // Sample JSON data (can be replaced with an API)
  const reviewsData = {
    averageRating: 4.5,
    totalReviews: 120,
    ratingsBreakdown: [
      { stars: 5, percent: 40 },
      { stars: 4, percent: 30 },
      { stars: 3, percent: 15 },
      { stars: 2, percent: 10 },
      { stars: 1, percent: 5 },
    ],
    reviews: [
      {
        name: 'Sophia Bennett',
        avatar: '/avatars/sophia.png',
        rating: 5,
        timeAgo: '1 month ago',
        comment:
          'This course was fantastic! The instructor explained complex concepts clearly, and the hands-on exercises were very helpful. I feel confident in my Python skills now.',
        likes: 15,
        replies: 2,
      },
      {
        name: 'Liam Harper',
        avatar: '/avatars/liam.png',
        rating: 4,
        timeAgo: '2 months ago',
        comment:
          'The course content was well-structured and easy to follow. I appreciated the practical examples and projects. However, some modules could use more in-depth explanations.',
        likes: 8,
        replies: 1,
      },
    ],
  };

  // Function to display stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex text-blue-500">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            fill={index < rating ? 'currentColor' : 'none'}
            strokeWidth={1.5}
            className="w-5 h-5"
          />
        ))}
      </div>
    );
  };

  return (
    <div className=" p-8 flex ml-8 mr-8">
    <div className='left p-6  w-[60%] bg-white shadow-md'>
      {/* Header */}
      <h2 className="text-2xl font-semibold mb-4">Ratings & Reviews</h2>

      {/* Rating Summary */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="text-center sm:text-left">
          <p className="text-4xl font-bold">{reviewsData.averageRating}</p>
          {renderStars(Math.round(reviewsData.averageRating))}
          <p className="text-gray-500">{reviewsData.totalReviews} reviews</p>
        </div>

        <div className="flex-1 space-y-2">
          {reviewsData.ratingsBreakdown.map(({ stars, percent }) => (
            <div key={stars} className="flex items-center gap-2">
              <p className="w-4 text-sm">{stars}</p>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
              <p className="w-10 text-sm text-gray-500">{percent}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-6">
        {reviewsData.reviews.map((review, index) => (
          <div key={index} className="flex gap-4">
            {/* User Avatar */}
            <img
              src={review.avatar}
              alt={review.name}
              className="w-12 h-12 rounded-full"
            />

            {/* Review Content */}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">{review.name}</p>
                <p className="text-sm text-gray-500">{review.timeAgo}</p>
              </div>

              {renderStars(review.rating)}

              <p className="text-gray-700 mt-2">{review.comment}</p>

              {/* Likes and replies */}
              <div className="flex gap-6 text-gray-500 text-sm mt-2 items-center">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" /> {review.likes}
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" /> {review.replies}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
};

export default RatingsAndReviews;
