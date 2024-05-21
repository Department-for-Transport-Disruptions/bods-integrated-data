/* eslint-disable no-console */
import { KyselyDb, NewAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { siriSchemaTransformed } from "@bods-integrated-data/shared/schema/siri.schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import axios, { AxiosResponse } from "axios";
import { XMLParser } from "fast-xml-parser";
import { sql } from "kysely";
import { Entry, Parse } from "unzipper";
import { Stream } from "stream";

const { PROCESSOR_FREQUENCY_IN_SECONDS: processorFrequency, CLEARDOWN_FREQUENCY_IN_SECONDS: cleardownFrequency } =
    process.env;

if (!processorFrequency || !cleardownFrequency) {
    throw new Error(
        "Missing env vars - BUCKET_NAME, PROCESSOR_FREQUENCY_IN_SECONDS and CLEARDOWN_FREQUENCY_IN_SECONDS must be set",
    );
}

const uploadToDatabase = async (dbClient: KyselyDb, xml: string) => {
    const xmlParser = new XMLParser({
        numberParseOptions: {
            hex: false,
            leadingZeros: false,
        },
    });

    const parsedXml = xmlParser.parse(xml) as Record<string, unknown>;

    const parsedJson = siriSchemaTransformed.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        console.error("There was an error parsing the AVL data", parsedJson.error.format());

        throw new Error("Error parsing data");
    }

    const avlWithGeom = parsedJson.data.map(
        (item): NewAvl => ({
            ...item,
            geom:
                item.longitude && item.latitude
                    ? sql`ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)`
                    : null,
        }),
    );

    const chunkedAvl = chunkArray(avlWithGeom, 2000);

    await Promise.all(chunkedAvl.map((chunk) => dbClient.insertInto("avl_bods").values(chunk).execute()));
};

const unzipAndUploadToDatabase = async (dbClient: KyselyDb, avlResponse: AxiosResponse<Stream>) => {
    const zip = avlResponse.data.pipe(
        Parse({
            forceStream: true,
        }),
    );

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        if (fileName === "siri.xml") {
            await uploadToDatabase(dbClient, (await entry.buffer()).toString());
        }

        entry.autodrain();
    }

    return [];
};

void (async () => {
    console.time("avlprocess");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        console.info("Starting BODS AVL processor");

        const avlResponse = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/avl/download/bulk_archive", {
            responseType: "stream",
        });

        if (!avlResponse) {
            throw new Error("No AVL data found");
        }

        await unzipAndUploadToDatabase(dbClient, avlResponse);

        console.info("BODS AVL processor successful");
        console.timeEnd("avlprocess");
    } catch (e) {
        if (e instanceof Error) {
            console.error("There was a problem with the AVL retriever", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
