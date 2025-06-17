import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios from "axios";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const retrieveNaptanCsvData = async (bucketName: string) => {
    const response = await axios.get("https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv", {
        responseType: "arraybuffer",
    });

    await putS3Object({
        Bucket: bucketName,
        Key: "Stops.csv",
        ContentType: "text/csv",
        Body: response.data as string,
    });
};

const getAtcoAreaCodes = async (dbClient: KyselyDb) => {
    const nptgAdminAreas = await dbClient
        .selectFrom("nptg_admin_area_new")
        .select(["atco_code"])
        .distinctOn(["atco_code"])
        .where("atco_code", "!=", "900") // Ignore National Coach area code since the naptan api thinks it's invalid
        .execute();
    return nptgAdminAreas.map((nptgAdminArea) => nptgAdminArea.atco_code);
};

const retrieveNaptanDataForAreaCodes = async (areaCodes: string[], fileName: string, bucketName: string) => {
    const joinedAreaCodes = areaCodes.join(",");
    logger.info(`Retrieving Naptan XML data for ATCO area code: ${joinedAreaCodes}`);

    try {
        const response = await axios.get(
            `https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=xml&atcoAreaCodes=${joinedAreaCodes}`,
            {
                responseType: "arraybuffer",
            },
        );

        await putS3Object({
            Bucket: bucketName,
            Key: `${fileName}.xml`,
            ContentType: "application/xml",
            Body: response.data as string,
        });
    } catch (e) {
        if (axios.isAxiosError(e)) {
            logger.error(e.toJSON(), `Error retrieving Naptan XML data for ATCO area codes: ${joinedAreaCodes}`);
        } else {
            logger.error(e, "Unknown error occurred");
        }
    }
};

const retrieveNaptanXmlData = async (bucketName: string, atcoAreaCodes: string[]) => {
    const chunkedAreaCodes = chunkArray(atcoAreaCodes, Math.ceil(atcoAreaCodes.length / 2));

    await retrieveNaptanDataForAreaCodes(chunkedAreaCodes[0], "AreaBatch1", bucketName);
    await retrieveNaptanDataForAreaCodes(chunkedAreaCodes[1], "AreaBatch2", bucketName);
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    try {
        const { STAGE, BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        dbClient = dbClient || (await getDatabaseClient(STAGE === "local"));

        logger.info("Starting naptan retriever");

        const atcoAreaCodes = await getAtcoAreaCodes(dbClient);

        if (atcoAreaCodes.length === 0) {
            throw new Error("No ATCO area codes found in nptg_admin_area_new table");
        }

        await retrieveNaptanCsvData(bucketName);
        await retrieveNaptanXmlData(bucketName, atcoAreaCodes);

        logger.info("Naptan retriever successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the naptan retriever");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
