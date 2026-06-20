package vacademy.io.admin_core_service.features.slide.enums;

public enum DocumentTypeEnum {
    // PPT_ANIM: a .pptx converted to build-step snapshot images + a manifest
    // (rendered as a cross-fade slideshow on the learner side). document_slide.data
    // / published_data holds the deck base URL (manifest.json sits at <base>/manifest.json).
    PDF, DOC, DOCX, PPT_ANIM
}
