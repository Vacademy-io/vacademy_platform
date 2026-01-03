package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
public class UserServiceDTO {

    private String username;
    private String userId;
    private boolean enabled;
    private List<String> roles = new ArrayList<>();
    private List<String> authorities = new ArrayList<>();

    public UserServiceDTO() {
        // Default constructor
    }
}
