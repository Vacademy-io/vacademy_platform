package vacademy.io.admin_core_service.features.common.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.entity.Rating;
import vacademy.io.admin_core_service.features.common.entity.RatingAction;
import vacademy.io.admin_core_service.features.common.enums.RatingActionType;
import vacademy.io.admin_core_service.features.common.repository.RatingActionRepository;
import vacademy.io.admin_core_service.features.common.repository.RatingRepository;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RatingActionService {

    private final RatingRepository ratingRepo;
    private final RatingActionRepository ratingActionRepo;

    @Transactional
    public void likeRating(String userId, String ratingId) {
        Rating rating = ratingRepo.findById(ratingId).orElseThrow(() -> new RuntimeException("Rating not found"));
        Optional<RatingAction> existing = ratingActionRepo.findByUserIdAndRatingId(userId, ratingId);

        if (existing.isPresent()) {
            RatingAction action = existing.get();
            if (action.getActionType() == RatingActionType.LIKE) {
                rating.setLikes(Math.max(0, rating.getLikes() - 1));
                ratingActionRepo.delete(action); // Neutralize
            } else {
                // Switch from dislike to like
                rating.setDislikes(Math.max(0, rating.getDislikes() - 1));
                rating.setLikes(rating.getLikes() + 1);
                action.setActionType(RatingActionType.LIKE);
                ratingActionRepo.save(action);
            }

        } else {
            RatingAction newAction = new RatingAction();
            newAction.setUserId(userId);
            newAction.setRating(rating);
            newAction.setActionType(RatingActionType.LIKE);
            ratingActionRepo.save(newAction);
            rating.setLikes(rating.getLikes() + 1);
        }

        ratingRepo.save(rating);
    }

    @Transactional
    public void dislikeRating(String userId, String ratingId) {
        Rating rating = ratingRepo.findById(ratingId).orElseThrow(() -> new RuntimeException("Rating not found"));
        Optional<RatingAction> existing = ratingActionRepo.findByUserIdAndRatingId(userId, ratingId);

        if (existing.isPresent()) {
            RatingAction action = existing.get();
            if (action.getActionType() == RatingActionType.DISLIKE) {
                rating.setDislikes(Math.max(0, rating.getDislikes() - 1));
                ratingActionRepo.delete(action); // Neutralize
            } else {
                // Switch from like to dislike
                rating.setLikes(Math.max(0, rating.getLikes() - 1));
                rating.setDislikes(rating.getDislikes() + 1);
                action.setActionType(RatingActionType.DISLIKE);
                ratingActionRepo.save(action);
            }
        } else {
            RatingAction newAction = new RatingAction();
            newAction.setUserId(userId);
            newAction.setRating(rating);
            newAction.setActionType(RatingActionType.DISLIKE);
            ratingActionRepo.save(newAction);
            rating.setDislikes(rating.getDislikes() + 1);
        }

        ratingRepo.save(rating);
    }

    @Transactional
    public void neutralizeReaction(String userId, String ratingId) {
        Rating rating = ratingRepo.findById(ratingId).orElseThrow(() -> new RuntimeException("Rating not found"));
        Optional<RatingAction> existing = ratingActionRepo.findByUserIdAndRatingId(userId, ratingId);

        if (existing.isEmpty()) return;

        RatingAction action = existing.get();
        if (action.getActionType() == RatingActionType.LIKE) {
            rating.setLikes(Math.max(0, rating.getLikes() - 1));
        } else if (action.getActionType() == RatingActionType.DISLIKE) {
            rating.setDislikes(Math.max(0, rating.getDislikes() - 1));
        }

        ratingActionRepo.delete(action);
        ratingRepo.save(rating);
    }
}
