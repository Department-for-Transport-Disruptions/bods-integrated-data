import { logger } from "@baselime/lambda-logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import axios from "axios";
import { PassThrough, Stream } from "stream";

const getBankHolidaysAndUploadToS3 = async (bankHolidaysBucketName: string) => {
    const response = await axios.get<Stream>("https://www.gov.uk/bank-holidays.json", {
        responseType: "stream",
    });

    const passThrough = new PassThrough();

    const upload = startS3Upload(bankHolidaysBucketName, "bank-holidays.json", passThrough, "application/json");

    response.data.pipe(passThrough);

    await upload.done();
};

export const handler = async () => {
    const { BANK_HOLIDAYS_BUCKET_NAME: bankHolidaysBucketName } = process.env;

    if (!bankHolidaysBucketName) {
        throw new Error("Missing env vars - BANK_HOLIDAYS_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of bank holidays data");

        await getBankHolidaysAndUploadToS3(bankHolidaysBucketName);

        logger.info("Bank Holidays retrieval complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving Bank Holidays data", e);
        }

        throw e;
    }
};
