package vacademy.io.common.payment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "payments_log")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class WebhookEventLog {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "request")
    private String requestPayload;

    @Column(name = "created_on", updatable = false)
    private Date createdOn;

    @Column(name = "updated_on")
    private Date updatedOn;

}
