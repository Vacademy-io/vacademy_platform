package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@AllArgsConstructor
@Data
@NoArgsConstructor
public class DeleteLiveSessionRequest {
    private List<String> ids;
    private String type;
}

