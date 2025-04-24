import { program } from "commander";
import { STAGE_OPTION } from "../utils";

program
    .addOption(STAGE_OPTION)
    .action(async () => {
        // Currently not supported due to "InvalidAccessKeyId" error when attempting to access the TfL iBus bucket
    })
    .parse();
