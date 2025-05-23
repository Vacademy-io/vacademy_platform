export const formatHTMLString = (htmlString: string) => {
    // Remove the body tag and its attributes
    let cleanedHtml = htmlString.replace(/<body[^>]*>|<\/body>/g, '');

    // Remove data-meta attributes and style from paragraphs
    cleanedHtml = cleanedHtml.replace(/<p[^>]*data-meta[^>]*style="[^"]*"[^>]*>/g, '<p>');

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
