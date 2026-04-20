/**
 * Strip query parameters from any AWS S3 URLs as these are public assets and
 * temporary signatures can be expired/stale. We only target hosts containing
 * "amazonaws.com" and remove everything after the first '?' character.
 */
export const stripAwsQueryParamsFromUrls = (htmlString: string): string => {
    const awsSignedUrlRegex = /https?:\/\/[^"'()<>\s]*amazonaws\.com[^"'()<>\s]*\?[^"'()<>\s]*/gi;
    return htmlString.replace(awsSignedUrlRegex, (matched: string): string => {
        const qIndex = matched.indexOf('?');
        return qIndex === -1 ? matched : matched.slice(0, qIndex);
    });
};

export const formatHTMLString = (htmlString: string) => {
    // Strip any existing html/head/body wrappers first to make this idempotent.
    // This prevents double-wrapping on repeated save cycles.
    let cleanedHtml = htmlString
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '');

    // Remove data-meta attributes and style from paragraphs. The \s guard
    // prevents matching <pre …> (prefix-share with <p), which would turn
    // <pre …>…</pre> into malformed <p>…</pre> and destroy code blocks.
    cleanedHtml = cleanedHtml.replace(/<p\s[^>]*data-meta[^>]*style="[^"]*"[^>]*>/g, '<p>');

    // Drop empty image blocks. The Yoopta Image plugin initialises new
    // blocks with src=null; if the user opens the uploader and closes it
    // without uploading, the template literal serializes src="null" and
    // the block re-appears as a broken thumbnail on every reload.
    cleanedHtml = cleanedHtml.replace(
        /<div[^>]*>\s*<img[^>]*\ssrc="(?:null|undefined|)"[^>]*\/?>\s*<\/div>/gi,
        ''
    );
    cleanedHtml = cleanedHtml.replace(
        /<img[^>]*\ssrc="(?:null|undefined|)"[^>]*\/?>(?!\s*<\/div>)/gi,
        ''
    );

    // Strip expired query params from public S3 URLs
    cleanedHtml = stripAwsQueryParamsFromUrls(cleanedHtml);

    // Trim whitespace from stripping
    cleanedHtml = cleanedHtml.trim();

    // Add proper HTML structure
    const formattedHtml = `<html>
    <head></head>
    <body>
        <div>
            ${cleanedHtml}
        </div>
    </body>
</html>`;

    return formattedHtml;
};
