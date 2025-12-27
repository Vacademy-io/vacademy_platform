package vacademy.io.notification_service.features.combot.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Enum for WhatsApp provider types
 */
@Getter
@RequiredArgsConstructor
public enum WhatsAppProvider {
    
    META("META", "Meta (Facebook) WhatsApp Business API"),
    COMBOT("COMBOT", "Com.bot WhatsApp Provider"),
    WATI("WATI", "WATI WhatsApp Provider");

    private final String provider;
    private final String description;

    /**
     * Get enum from provider string
     */
    public static WhatsAppProvider fromString(String provider) {
        if (provider == null) {
            return META; // Default to META
        }
        
        for (WhatsAppProvider whatsAppProvider : values()) {
            if (whatsAppProvider.provider.equalsIgnoreCase(provider)) {
                return whatsAppProvider;
            }
        }
        
        return META; // Default fallback
    }
}
