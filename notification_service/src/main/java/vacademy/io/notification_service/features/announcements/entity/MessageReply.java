package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "message_replies")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class MessageReply {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "parent_message_id")
    private String parentMessageId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_message_id", insertable = false, updatable = false)
    private MessageReply parentMessage;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(name = "user_name")
    private String userName;
    
    @Column(name = "user_role", length = 100)
    private String userRole;
    
    @Column(name = "rich_text_id", nullable = false)
    private String richTextId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rich_text_id", insertable = false, updatable = false)
    private RichTextData richTextData;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    // For threading - child replies
    @OneToMany(mappedBy = "parentMessage", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MessageReply> childReplies;
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}