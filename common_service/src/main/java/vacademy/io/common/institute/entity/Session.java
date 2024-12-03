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
@Table(name = "session", schema = "public")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Session {

    @Id
    @Column(name = "id")
    @UuidGenerator
    private String id;

    @Column(name = "session_name")
    private String sessionName;

    @Column(name = "status")
    private String status;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

}