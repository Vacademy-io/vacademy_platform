package vacademy.io.common.institute.entity.session;


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
@Table(name = "session")
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

    @Column(name = "start_date")
    private Date startDate;
}