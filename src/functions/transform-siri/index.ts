import {
    FirehoseTransformationEventRecord,
    FirehoseTransformationHandler,
    FirehoseTransformationResultRecord,
} from "aws-lambda";
import { json2csv } from "json-2-csv";
import * as logger from "lambda-log";
import { parseString } from "xml2js";
import { parseBooleans } from "xml2js/lib/processors.js";
import { siriSchema, SiriSchema } from "./schema/siri.schema";

interface parsedXmlSiri {
    Siri: SiriSchema;
}

const parseXml = (xml: string) => {
    let parsedXml = { Siri: {} };
    let error = null;

    parseString(
        xml,
        { explicitArray: false, valueProcessors: [parseBooleans], ignoreAttrs: true },
        (err, result: parsedXmlSiri) => {
            error = err;
            parsedXml = result;
        },
    );

    return {
        parsedXml,
        error,
    };
};

export const transformXmlToCsv = (siriXml: string) => {
    const siriJson = parseXml(siriXml).parsedXml;

    if (parseXml(siriXml).error) {
        logger.warn("XML unable to be parsed to JSON.");
        return null;
    }

    const formattedSiri = siriSchema.safeParse(siriJson.Siri);

    if (!formattedSiri.success) {
        logger.warn(`Failed to parse SIRI-VM: ${JSON.stringify(formattedSiri.error)}`);
        return null;
    }

    return json2csv([formattedSiri.data]);
};

export const main: FirehoseTransformationHandler = (event, context, callback) => {
    try {
        logger.info(`Starting transformation of SIRI-VM. Number of records to process: ${event.records.length}`);

        const { CAVL_TABLE_NAME: cavlTableName, CAVL_TABLE_SCHEMA: cavlTableSchema } = process.env;

        if (!cavlTableSchema || !cavlTableName) {
            throw new Error("CAVL table name and schema must be set.");
        }

        const output: FirehoseTransformationResultRecord[] = event.records.map(
            (record: FirehoseTransformationEventRecord) => {
                const siriXml = Buffer.from(record.data, "base64").toString();

                const siriCsv = transformXmlToCsv(siriXml);

                if (!siriCsv) {
                    return { recordId: record.recordId, result: "Dropped" };
                }

                const encodedSiri = Buffer.from(`INSERT, ${cavlTableName}, ${cavlTableSchema}, ${siriCsv}\n`).toString(
                    "base64",
                );

                return { recordId: record.recordId, result: "Ok", data: encodedSiri };
            },
        );

        logger.info(
            `Processing completed.  Successful records: ${output.filter((record) => record.result === "Ok").length}.`,
        );
        callback(null, { records: output });
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);

            throw e;
        }

        throw e;
    }
};
