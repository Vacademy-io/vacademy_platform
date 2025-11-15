package vacademy.io.community_service.feature.presentation.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.Where;
import vacademy.io.common.auth.entity.UserRole;

import java.util.Date;
import java.util.HashSet;
import java.util.Set;

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

    @Column(name = "institute_id", length = 955)
    private String instituteId;

    @Column(name = "status", length = 955)
    private String status;

    @Column(name = "cover_file_id", length = 255)
    private String coverFileId;

    @OneToMany(mappedBy = "presentation", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Where(clause = "status = 'PUBLISHED'")
    private Set<PresentationSlide> presentationSlides  = new HashSet<>();

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}