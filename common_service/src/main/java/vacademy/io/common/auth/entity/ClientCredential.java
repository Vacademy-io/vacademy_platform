package vacademy.io.common.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "client_credentials")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClientCredential {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "token")
    private String token;

    @Column(name = "created_at",insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at",insertable = false, updatable = false)
    private Timestamp updatedAt;
}
