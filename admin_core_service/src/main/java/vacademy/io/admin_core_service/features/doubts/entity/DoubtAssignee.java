package vacademy.io.admin_core_service.features.doubts.entity;


import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtAssigneeDto;

import java.util.Date;

@Entity
@Table(name = "doubt_assignee")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
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

    public DoubtAssigneeDto getAssigneeDto(){
        return DoubtAssigneeDto.builder()
                .id(this.id)
                .source(this.source)
                .sourceId(this.sourceId)
                .status(this.status)
                .build();
    }

}
