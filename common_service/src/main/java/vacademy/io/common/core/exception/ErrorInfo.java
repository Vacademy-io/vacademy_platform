package vacademy.io.common.core.exception;

import java.util.Date;

public record ErrorInfo(String url, String ex, String responseCode, Date date) {
}