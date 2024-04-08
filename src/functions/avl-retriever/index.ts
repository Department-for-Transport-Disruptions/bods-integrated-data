import { logger } from "@baselime/lambda-logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import axios, { AxiosResponse } from "axios";
import { Entry, Parse } from "unzipper";
import { Stream } from "stream";

const unzipAndUploadToS3 = async (avlResponse: AxiosResponse<Stream>, targetBucketName: string) => {
    const zip = avlResponse.data.pipe(
        Parse({
            forceStream: true,
        }),
    );

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        if (fileName === "siri.xml") {
            const upload = startS3Upload(targetBucketName, "bods-siri-vm.xml", entry, "application/xml");

            await upload.done();
        }

        entry.autodrain();
    }
};

export const handler = async () => {
    try {
        const { TARGET_BUCKET_NAME: targetBucketName } = process.env;

        if (!targetBucketName) {
            throw new Error("Missing env vars - TARGET_BUCKET_NAME must be set");
        }

        logger.info("Starting AVL retriever");

        const avlResponse = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/avl/download/bulk_archive", {
            responseType: "stream",
        });

        if (!avlResponse) {
            throw new Error("No AVL data found");
        }

        await unzipAndUploadToS3(avlResponse, targetBucketName);

        logger.info("AVL retriever successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL retriever", e);
        }

        throw e;
    }
};
