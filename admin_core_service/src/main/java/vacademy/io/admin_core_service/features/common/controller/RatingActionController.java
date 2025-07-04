package vacademy.io.admin_core_service.features.common.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.service.RatingActionService;

@RestController
@RequestMapping("/admin-core-service/rating/action")
@RequiredArgsConstructor
public class RatingActionController {

    private final RatingActionService ratingService;

    @PostMapping("/{ratingId}/like")
    public void likeRating(@RequestParam String userId, @PathVariable String ratingId) {
        ratingService.likeRating(userId, ratingId);
    }

    @PostMapping("/{ratingId}/dislike")
    public void dislikeRating(@RequestParam String userId, @PathVariable String ratingId) {
        ratingService.dislikeRating(userId, ratingId);
    }

    @PostMapping("/{ratingId}/neutralize")
    public void neutralize(@RequestParam String userId, @PathVariable String ratingId) {
        ratingService.neutralizeReaction(userId, ratingId);
    }
}
