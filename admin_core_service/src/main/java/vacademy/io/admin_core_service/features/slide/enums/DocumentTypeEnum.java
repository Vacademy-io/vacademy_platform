package vacademy.io.admin_core_service.features.slide.enums;

public enum DocumentTypeEnum {
    // PPT_ANIM: a .pptx converted to build-step snapshot images + a manifest
    // (rendered as a cross-fade slideshow on the learner side). document_slide.data
    // / published_data holds the deck base URL (manifest.json sits at <base>/manifest.json).
    // HTML: Tiptap-authored rich-text document. data / published_data hold a
    // plain HTML string (same storage as DOC, but authored with the new editor
    // instead of Yoopta — no Yoopta block markers).
    PDF, DOC, DOCX, PPT_ANIM, HTML
}
