package vacademy.io.common.core.standard_classes;

import org.springframework.data.domain.Sort;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ListService {

    public static Sort createSortObject(Map<String, String> sortMap) {
        //Todo: Testing for sorting
        if (sortMap == null) return Sort.unsorted();

        List<Sort.Order> orders = new ArrayList<>();
        for (Map.Entry<String, String> entry : sortMap.entrySet()) {
            Sort.Direction direction = "DESC".equalsIgnoreCase(entry.getValue()) ? Sort.Direction.DESC : Sort.Direction.ASC;
            orders.add(new Sort.Order(direction, entry.getKey()));
        }

        return Sort.by(orders);
    }
}
