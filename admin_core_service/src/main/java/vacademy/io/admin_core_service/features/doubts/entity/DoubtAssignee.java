package vacademy.io.admin_core_service.features.doubts.entity;


import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "doubt_assignee")
@Data
@Builder
public class DoubtAssignee {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "doubt_id")
    @JsonIgnore
    private Doubts doubts;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "source")
    private String source;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

}
