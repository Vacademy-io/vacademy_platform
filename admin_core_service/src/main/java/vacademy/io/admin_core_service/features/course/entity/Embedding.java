package vacademy.io.admin_core_service.features.course.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.Date;
import java.util.List;

@Table(name = "embeddings")
@Entity
@Builder
@Data
@Getter
@Setter
public class Embedding {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "source")
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "embedding")
    private List<Float> embedding;

    @Column(name = "created_at", updatable = false, insertable = false)
    private Date createdAt;

    @Column(name = "updated_at", updatable = false, insertable = false)
    private Date updatedAt;
}
