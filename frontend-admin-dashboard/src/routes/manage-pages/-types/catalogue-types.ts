export interface CatalogueTag {
    id?: string;
    tagName: string;
    status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'; // Backend uses uppercase
    lastModified?: string;
    catalogueJson?: string; // Stringified JSON
}

export interface CreateCatalogueTagRequest {
    tagName: string;
    catalogue_json: string;
}
