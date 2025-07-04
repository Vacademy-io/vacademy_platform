package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.enums.RatingActionType;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "rating_action", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "rating_id"})
})
public class RatingAction {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rating_id", nullable = false)
    private Rating rating;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private RatingActionType actionType; // LIKE or DISLIKE

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
