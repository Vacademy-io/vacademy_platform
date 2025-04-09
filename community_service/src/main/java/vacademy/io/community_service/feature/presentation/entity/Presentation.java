package vacademy.io.community_service.feature.presentation.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.Date;

@Entity
@Table(name = "presentation", schema = "public")
@Builder
@Getter
@Setter
@EqualsAndHashCode(of = "id")
@NoArgsConstructor
@AllArgsConstructor
public class Presentation {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "description", length = 955)
    private String description;

    @Column(name = "cover_file_id", length = 255)
    private String coverFileId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}