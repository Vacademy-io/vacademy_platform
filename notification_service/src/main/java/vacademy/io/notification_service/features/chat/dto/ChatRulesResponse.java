package vacademy.io.notification_service.features.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRulesResponse {
    private ChatRulesDto rules;       // effective rules (override ?? institute defaults)
    private int currentVersion;       // conversation.rulesVersion
    private boolean acknowledged;     // caller has accepted the current version
    private boolean isOverride;       // true if rules come from an in-channel override
    private boolean canEdit;          // caller is OWNER/MODERATOR
}
