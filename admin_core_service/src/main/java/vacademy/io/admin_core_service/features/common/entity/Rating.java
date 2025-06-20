package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.dto.RatingDTO;
import vacademy.io.admin_core_service.features.common.dto.RatingDetailDTO;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
public class Rating {
    @Id
    @UuidGenerator
    private String id;
    private double points;
    private String userId;
    private long likes = 0;
    private long dislikes = 0;
    private String sourceId;
    private String sourceType;
    private String text;
    private String status;
    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public Rating() {
    }

    public Rating(RatingDTO ratingDTO) {
        this.points = ratingDTO.getPoints();
        this.userId = ratingDTO.getUserId();
        this.text = ratingDTO.getText();
        this.sourceId = ratingDTO.getSourceId();
        this.sourceType = ratingDTO.getSourceType();
        this.status = ratingDTO.getStatus();
        this.likes = ratingDTO.getLikes();
        this.dislikes = ratingDTO.getDislikes();
    }

    public Rating(double points,
                  String userId,
                  String sourceId,
                  String sourceType,
                  long likes,
                  long dislikes,
                  String text) {
        this.likes = likes;
        this.dislikes = dislikes;
        this.points = points;
        this.userId = userId;
        this.sourceId = sourceId;
        this.sourceType = sourceType;
        this.text = text;
        this.status = StatusEnum.ACTIVE.name();
    }

    public RatingDTO toRatingDTO() {
        RatingDTO ratingDTO = new RatingDTO();
        ratingDTO.setId(this.id);
        ratingDTO.setPoints(this.points);
        ratingDTO.setUserId(this.userId);
        ratingDTO.setSourceId(this.sourceId);
        ratingDTO.setSourceType(this.sourceType);
        ratingDTO.setText(this.text);
        ratingDTO.setStatus(this.status);
        ratingDTO.setLikes(this.likes);
        ratingDTO.setDislikes(this.dislikes);
        return ratingDTO;
    }

    public RatingDetailDTO mapToRatingDetailDTO() {
        RatingDetailDTO ratingDetailDTO = new RatingDetailDTO();
        ratingDetailDTO.setId(this.id);
        ratingDetailDTO.setPoints(this.points);
        ratingDetailDTO.setSourceId(this.sourceId);
        ratingDetailDTO.setSourceType(this.sourceType);
        ratingDetailDTO.setText(this.text);
        ratingDetailDTO.setStatus(this.status);
        ratingDetailDTO.setLikes(this.likes);
        ratingDetailDTO.setDislikes(this.dislikes);
        ratingDetailDTO.setCreatedAt(this.createdAt);
        ratingDetailDTO.setUpdatedAt(this.updatedAt);
        return ratingDetailDTO;
    }
}
