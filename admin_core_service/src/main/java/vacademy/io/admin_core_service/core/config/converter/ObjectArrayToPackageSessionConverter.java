package vacademy.io.admin_core_service.core.config.converter;

import org.springframework.core.convert.converter.Converter;
import vacademy.io.common.institute.entity.PackageSession;

public class ObjectArrayToPackageSessionConverter implements Converter<Object[], PackageSession> {

    @Override
    public PackageSession convert(Object[] source) {
        // Implement conversion logic here
        PackageSession packageSession = new PackageSession();
        // Map properties from source array to packageSession object
        return packageSession;
    }
}