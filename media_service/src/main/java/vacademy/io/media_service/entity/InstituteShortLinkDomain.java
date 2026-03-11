package vacademy.io.media_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;
import java.time.LocalDateTime;

@Entity
@Table(name = "backend_base_url")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteShortLinkDomain {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false, unique = true)
    private String instituteId;

    @Column(name = "base_url", nullable = false)
    private String baseUrl;

    @UpdateTimestamp
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @CreationTimestamp
    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}
