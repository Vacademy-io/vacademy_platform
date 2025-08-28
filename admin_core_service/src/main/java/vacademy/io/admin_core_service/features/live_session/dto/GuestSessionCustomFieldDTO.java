package vacademy.io.admin_core_service.features.live_session.dto;

import java.sql.Timestamp;

public interface GuestSessionCustomFieldDTO {
    String getGuestId();

    String getLiveSessionId();

    String getCustomFieldId();

    String getFieldKey();

    String getFieldName();

    String getFieldType();

    String getDefaultValue();

    String getConfig();

    Integer getFormOrder();

    Boolean getIsMandatory();

    Boolean getIsFilter();

    Boolean getIsSortable();

    Boolean getIsHidden();

    Timestamp getCreatedAt();

    Timestamp getUpdatedAt();

    String getCustomFieldValue();
}
