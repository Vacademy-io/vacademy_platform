// Lightweight HTML viewer for PPT mode (presentation rendering only)
export const PPTViewQuillEditor = ({ value, onChange, placeholder = '', className = '' }) => {
    // Presentation view is read/write via HTML; keep simple div to avoid heavy editor deps
    return (
        <div className={className}>
            {!value && placeholder ? (
                <div className="text-neutral-400">{placeholder}</div>
            ) : (
                <div
                    className="prose max-w-none"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: value || '' }}
                    onInput={(e) => onChange?.(e.currentTarget.innerHTML)}
                    contentEditable
                    suppressContentEditableWarning
                />
            )}
        </div>
    );
};
