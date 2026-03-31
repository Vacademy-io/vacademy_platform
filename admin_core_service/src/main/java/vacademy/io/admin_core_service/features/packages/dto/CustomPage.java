package vacademy.io.admin_core_service.features.packages.dto;

import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * A Page implementation that always uses the provided total,
 * even when content.size() exceeds pageable.getPageSize().
 * Used by package-view mode where content rows (sessions) can exceed the page size (packages).
 */
public class CustomPage<T> extends PageImpl<T> {

    private final long customTotal;

    public CustomPage(List<T> content, Pageable pageable, long total) {
        super(content, pageable, Long.MAX_VALUE); // trick: pass MAX_VALUE so super doesn't override
        this.customTotal = total;
    }

    @Override
    public long getTotalElements() {
        return customTotal;
    }

    @Override
    public int getTotalPages() {
        return getSize() == 0 ? 1 : (int) Math.ceil((double) customTotal / (double) getSize());
    }

    @Override
    public boolean isLast() {
        return getNumber() + 1 >= getTotalPages();
    }
}
