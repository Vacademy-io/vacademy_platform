package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
        import lombok.*;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "custom_field_values")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomFieldValues {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "custom_field_id", nullable = false)
    private Integer customFieldId;

    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    private String type;

    @Column(name = "type_id")
    private String typeId;

    @Column(columnDefinition = "TEXT")
    private String value;
}

