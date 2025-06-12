import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function isNullOrEmptyOrUndefined<T>(
    value: T | null | undefined,
): value is null | undefined {
    return value === null || value === undefined || (typeof value === "string" && value === "");
}

export function convertCapitalToTitleCase(str: string) {
    // Split the text into words
    const words = str?.split(" ");

    // Capitalize the first letter of each word and convert the rest to lowercase
    const titleCaseWords = words?.map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    );

    // Join the words back into a string
    const titleCaseText = titleCaseWords?.join(" ");

    return titleCaseText;
}

export function parseHtmlToString(html: string) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || doc.body.innerText || "";
}

export const goToWhatsappSupport = () => {
    const phoneNumber = "+919201534254"; // Your WhatsApp number (with country code)
    const message = encodeURIComponent("Hello, I have a question.");

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    window.open(whatsappUrl, "_blank");
};

/**
 * Opens the user's default email client to send a support request.
 */
export const goToMailSupport = () => {
    const supportEmail = "hello@vacademy.io";
    const subject = encodeURIComponent("Support Request");
    const body = encodeURIComponent("I need help with: \n[Describe your issue here]");

    const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

    window.location.href = mailtoUrl;
};
