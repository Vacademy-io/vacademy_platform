package vacademy.io.community_service.feature.addFilterToEntity.entity;


import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "question_paper")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class question_paper {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(name = "description_id", nullable = false)
    private Long descriptionId;

    @Column(name = "created_on", nullable = false, updatable = false)
    private LocalDateTime createdOn;

    @Column(name = "updated_on")
    private LocalDateTime updatedOn;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(nullable = false)
    private String access;
}

