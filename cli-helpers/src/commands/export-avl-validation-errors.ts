import { writeFileSync } from "node:fs";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { AvlValidationError, avlValidationErrorsSchema } from "@bods-integrated-data/shared/schema";
import { program } from "commander";
import { asString, generateCsv, mkConfig } from "export-to-csv";
import { STAGES, recursiveScan, withUserPrompt } from "../utils";
import { createDynamoDbDocClient } from "../utils/awsClients";

const saveResultsToCsv = (data: AvlValidationError[], filename: string) => {
    if (data.length === 0) {
        logger.info("No data to save");
        return;
    }

    const csvConfig = mkConfig({
        quoteStrings: false,
        useKeysAsHeaders: true,
    });

    const csv = generateCsv(csvConfig)(data);
    const csvBuffer = new Uint8Array(Buffer.from(asString(csv)));
    writeFileSync(filename, csvBuffer);

    logger.info(`Results written to ${filename}`);
};

program
    .option("-s, --stage <stage>", "Stage of the environment")
    .action(async (options) => {
        let { stage } = options;

        if (!stage) {
            stage = await withUserPrompt("stage", { type: "list", choices: STAGES });
        }

        const tableName = `integrated-data-avl-validation-error-table-${stage}`;
        const dynamoDbClient = createDynamoDbDocClient(stage);

        try {
            logger.info(`Scanning DynamoDB table: ${tableName}`);
            const tableItems = await recursiveScan(dynamoDbClient, { TableName: tableName });

            const validationErrors = avlValidationErrorsSchema.safeParse(tableItems).data || [];

            const today = getDate().format("YYYY-MM-DD");
            const filename = `integrated-data-avl-validation-errors-${today}.csv`;

            saveResultsToCsv(validationErrors, filename);
        } catch (error) {
            logger.error(error, "Error scanning DynamoDB table");
        } finally {
            dynamoDbClient.destroy();
        }
    })
    .parse();
