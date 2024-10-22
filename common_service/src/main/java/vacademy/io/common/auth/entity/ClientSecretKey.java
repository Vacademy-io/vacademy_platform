package vacademy.io.common.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class ClientSecretKey {
    @Id
    @Column(name = "client_name")
    private String clientName;
    @Column(name = "secret_key")
    private String secretKey;

}
