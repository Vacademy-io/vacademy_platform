package vacademy.io.admin_core_service.features.student_analysis.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "user_linked_data")
@Getter
@Setter
@NoArgsConstructor
public class UserLinkedData {

        @Id
        @UuidGenerator
        private String id;

        @Column(name = "user_id", nullable = false)
        private String userId;

        @Column(name = "type", nullable = false)
        private String type; // strength, weakness

        @Column(name = "data", nullable = false)
        private String data; // algebra, geometry, p-block, etc.

        @Column(name = "percentage")
        private Integer percentage; // 30, 45, 50 etc.

        @Column(name = "created_at", insertable = false, updatable = false)
        private Timestamp createdAt;

        @Column(name = "updated_at", insertable = false, updatable = false)
        private Timestamp updatedAt;

        public UserLinkedData(String userId, String type, String data, Integer percentage) {
                this.userId = userId;
                this.type = type;
                this.data = data;
                this.percentage = percentage;
        }
}
