package vacademy.io.common.institute.entity.module;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Data
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "modules")
public class Module {
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "module_name")
    private String moduleName;

    @Column(name = "status")
    private String status = "ACTIVE";

    @Column(name = "description")
    private String description;

    @Column(name = "thumbnail_id")
    private String thumbnailId;
}
