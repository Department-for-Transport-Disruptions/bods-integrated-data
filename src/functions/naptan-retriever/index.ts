import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
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
        .selectAll()
        .distinctOn(["atco_code"])
        .execute();
    return nptgAdminAreas.map((nptgAdminArea) => nptgAdminArea.atco_code);
};

const retrieveNaptanXmlData = async (bucketName: string, atcoAreaCodes: string[]) => {
    for await (const atcoAreaCode of atcoAreaCodes) {
        try {
            const response = await axios.get(
                `https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=xml&atcoAreaCodes=${atcoAreaCode}`,
                {
                    responseType: "arraybuffer",
                },
            );

            await putS3Object({
                Bucket: bucketName,
                Key: `${atcoAreaCode}.xml`,
                ContentType: "application/xml",
                Body: response.data as string,
            });
        } catch (e) {
            if (axios.isAxiosError(e)) {
                logger.error(e, `Error retrieving Naptan XML data for ATCO area code: ${atcoAreaCode}`);
            } else {
                logger.error(e, "Unknown error occurred");
            }
        }
    }
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

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
