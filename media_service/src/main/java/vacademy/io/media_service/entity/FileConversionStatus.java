package vacademy.io.media_service.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "file_conversion_status")
public class FileConversionStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "file_id")
    private String fileId;

    @Column(name = "status")
    private String status;

    @Column(name = "vendor_file_id")
    private String vendorFileId;

    @Column(name = "html_text", columnDefinition = "TEXT")
    private String htmlText;

    @Column(name = "file_type")
    private String fileType;

    @Column(name = "vendor")
    private String vendor;

    @Column(name = "created_on", insertable = false, updatable = false)
    private Date createdOn;
}
