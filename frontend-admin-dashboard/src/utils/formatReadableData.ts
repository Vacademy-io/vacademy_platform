export function formatReadableDate(isoString: string | null): string {
    if (isoString == null) return "";
    const date = new Date(isoString);

    const options: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        day: "2-digit",
        month: "long",
        year: "numeric",
    };

    return new Intl.DateTimeFormat("en-US", options).format(date);
}
