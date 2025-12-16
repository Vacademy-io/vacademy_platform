package vacademy.io.notification_service.features.combot.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.sql.Timestamp;

@Entity
@Table(name = "channel_to_institute_mapping")
@Data
public class ChannelToInstituteMapping {
    @Id
    @Column(name = "channel_id")
    private String channelId;

    @Column(name = "channel_type")
    private String channelType;

    @Column(name = "display_channel_number")
    private String displayChannelNumber;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "is_active")
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
