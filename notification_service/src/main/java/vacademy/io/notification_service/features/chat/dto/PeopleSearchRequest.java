package vacademy.io.notification_service.features.chat.dto;

import lombok.Data;

import java.util.List;

@Data
public class PeopleSearchRequest {
    private List<String> roles;   // optional; null/empty = all roles the caller may DM
    private String nameQuery;     // name / email / mobile search
    private int pageNumber = 0;
    private int pageSize = 20;
}
