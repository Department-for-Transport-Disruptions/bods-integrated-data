import { NewBodsAvl } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import { siriBodsSchemaTransformed } from "@bods-integrated-data/shared/schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { XMLParser } from "fast-xml-parser";

const arrayProperties = ["VehicleActivity"];

export const parseXml = (xml: string): NewBodsAvl[] => {
    const xmlParser = new XMLParser({
        numberParseOptions: {
            hex: false,
            leadingZeros: false,
        },
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const parsedXml = xmlParser.parse(xml) as Record<string, unknown>;
    const parsedJson = siriBodsSchemaTransformed.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the AVL data", parsedJson.error.format());

        throw new InvalidXmlError();
    }

    return parsedJson.data;
};
