import { z } from "zod";

/**
 * Map a case-insensitive enum value to a case-sensitive enum value.
 * For example, using a case-insensitive value of "FirstValue" and the following enum:
 * enum TestEnum {
 *   firstValue = "firstValue",
 *   secondValue = "secondValue",
 * }
 * Then the function will return "firstValue". When a match can't be made, the original value is returned.
 * @param enumRecord The enum
 * @param caseInsensitiveValue The value to map
 * @returns The case-sensitive value if a matching enum value is found, otherwise the original value
 */
export const getMappedEnumValue = (enumRecord: Record<string, string>, caseInsensitiveValue: string) => {
    const lowerCaseValue = caseInsensitiveValue.toLowerCase();

    for (const enumValue of Object.values(enumRecord)) {
        if (lowerCaseValue === enumValue.toLowerCase()) {
            return enumValue;
        }
    }

    return caseInsensitiveValue;
};

/**
 * Constructs a zod schema for a given enum, allowing case-insensitive values to be transformed first.
 * @param enumRecord The enum
 * @returns The zod schema for the enum
 */
export const enumSchema = (enumRecord: Record<string, string>) => {
    return z
        .string()
        .transform((value) => getMappedEnumValue(enumRecord, value))
        .pipe(z.nativeEnum(enumRecord));
};
