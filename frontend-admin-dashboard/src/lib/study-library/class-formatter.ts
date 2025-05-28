// utils/class-formatter.ts
export const getClassSuffix = (classNumber: string | undefined) => {
    if (classNumber) {
        const num = parseInt(classNumber);
        if (num === 1) return "st";
        if (num === 2) return "nd";
        if (num === 3) return "rd";
    }
    return "th";
};
export const formatClassName = (classNumber: string | undefined) => {
    const suffix = getClassSuffix(classNumber);
    return `${classNumber}${suffix}`;
};

export const parseClassFromRoute = (className: string | undefined) => {
    // This will handle both "10th-class" and "3rd-class" formats
    if (className) {
        const match = className.match(/(\d+)(?:th|st|nd|rd)-class/);
        return match ? match[1] : "";
    }
    return "";
};
