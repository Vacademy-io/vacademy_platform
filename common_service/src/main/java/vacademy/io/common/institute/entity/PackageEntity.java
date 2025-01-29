package vacademy.io.common.institute.entity;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "package")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PackageEntity {

    @Id
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id;

    @Column(name = "package_name", length = 255)
    private String packageName;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "thumbnail_file_id", length = 255)
    private String thumbnailFileId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

}