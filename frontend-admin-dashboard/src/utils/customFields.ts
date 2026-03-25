// Father Name -> father_name
export const normalToSnakeCase = (str: string): string => {
    return str.at(0)?.toLowerCase() + str.slice(1).replace(/ /g, '_').toLowerCase();
};

export const convertToUpperCase = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
