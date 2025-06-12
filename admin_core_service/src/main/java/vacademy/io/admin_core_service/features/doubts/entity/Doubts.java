package vacademy.io.admin_core_service.features.doubts.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;
import java.util.List;

@Entity
@Table(name = "doubts")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Doubts {
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "source")
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "raised_time")
    private Date raisedTime;

    @Column(name = "resolved_time")
    private Date resolvedTime;

    @Column(name = "content_position")
    private String contentPosition;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "html_text")
    private String htmlText;

    @Column(name = "status")
    private String status;

    @Column(name = "parent_id")
    private String parentId;

    @Column(name = "parent_level")
    private Integer parentLevel;

    @Column(name = "package_session_id")
    private String packageSessionId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @OneToMany(mappedBy = "doubts", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DoubtAssignee> assignees;
}
