import { writeFile } from "node:fs/promises";
import { Command } from "@commander-js/extra-typings";
import csvToJson from "convert-csv-to-json";
import { z } from "zod";

const agencyCsvSchema = z.object({
    agency_id: z.string(),
    agency_name: z.string(),
    agency_url: z.string(),
    agency_timezone: z.string(),
    agency_lang: z.string(),
    agency_phone: z.string(),
    agency_noc: z.string(),
});

export const convertAgencyCsvToJson = new Command("convert-agency-csv-to-json")
    .option("-f, --filePath <filePath>", "Path to agencies csv file")
    .action(async ({ filePath }) => {
        const json = csvToJson
            .fieldDelimiter(",")
            .supportQuotedField(true)
            .getJsonFromCsv(filePath || "./agencies.csv");

        const parsedJson = agencyCsvSchema.array().parse(json);

        const agencies = parsedJson
            .map((item) => ({
                id: Number(item.agency_id.split("OP")[1]),
                name: item.agency_name,
                url: item.agency_url,
                phone: "",
                noc: item.agency_noc,
            }))
            .filter((item) => !!item.noc && item.noc !== '"')
            .sort((a, b) => (a.id < b.id ? -1 : 1));

        await writeFile("./agencies.json", JSON.stringify(agencies));
    });
