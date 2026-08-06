package vacademy.io.assessment_service.features.assessment.service.render;

import com.itextpdf.layout.font.FontProvider;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;

/**
 * Process-wide singleton {@link FontProvider}, built once at startup.
 * Addresses plan C7: rendering used to pull 'Inter' from a remote Google
 * Fonts {@code @import} on every PDF conversion — a synchronous network
 * fetch on the hot path of the bulk report export worker. This registers
 * Inter from the classpath if the font files are bundled at
 * {@code src/main/resources/fonts/}, and always falls back to iText's
 * standard PDF fonts (Helvetica etc.) so a missing font file degrades
 * gracefully rather than breaking rendering.
 *
 * <p>Bundling the actual Inter .ttf files is an ops/asset task outside this
 * change — see the fallback behaviour below, which is what runs until they
 * are added.
 *
 * <p>{@code FontProvider} is safe to share for read after construction; it
 * is never mutated after {@code @PostConstruct}.
 */
@Slf4j
@Component
public class ReportFontProviderHolder {

    private static final String[] INTER_FONT_FILES = {
            "fonts/Inter-Regular.ttf",
            "fonts/Inter-SemiBold.ttf",
            "fonts/Inter-Bold.ttf",
            "fonts/Inter-ExtraBold.ttf",
    };

    private FontProvider fontProvider;

    @PostConstruct
    public void init() {
        FontProvider provider = new FontProvider();
        int registered = 0;
        for (String path : INTER_FONT_FILES) {
            try (InputStream in = new ClassPathResource(path).getInputStream()) {
                byte[] bytes = in.readAllBytes();
                provider.addFont(bytes);
                registered++;
            } catch (Exception e) {
                // Expected until the Inter font assets are bundled — fall through
                // to the standard-font fallback below rather than failing startup.
                log.debug("[report-render] Font asset {} not available, will fall back to standard fonts: {}",
                        path, e.getMessage());
            }
        }
        provider.addStandardPdfFonts();
        if (registered == 0) {
            log.warn("[report-render] No bundled Inter font files found under classpath:fonts/. "
                    + "Report PDFs will render with standard PDF fonts until they are added.");
        } else {
            log.info("[report-render] Registered {} Inter font weight(s) for report rendering.", registered);
        }
        this.fontProvider = provider;
    }

    /** Never mutate the returned instance — it is shared across the process. */
    public FontProvider get() {
        return fontProvider;
    }
}
