package vacademy.io.admin_core_service.features.invoice.dto;

public interface InvoicePackageContextProjection {
    String getPackageId();

    String getPackageName();

    String getLevelId();

    String getLevelName();

    String getSessionId();

    String getSessionName();
}
