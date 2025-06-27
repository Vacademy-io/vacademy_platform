package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;


@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface RatingSummaryProjection {

    Double getAverageRating();

    Integer getTotalReviews();

    Double getPercentFiveStar();

    Double getPercentFourStar();

    Double getPercentThreeStar();

    Double getPercentTwoStar();

    Double getPercentOneStar();
}
