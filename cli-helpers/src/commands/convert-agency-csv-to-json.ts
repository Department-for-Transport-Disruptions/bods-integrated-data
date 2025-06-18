import { writeFile } from "node:fs/promises";
import { program } from "commander";
import csvToJson from "convert-csv-to-json";
import { z } from "zod";
import { withUserPrompts } from "../utils";

const agencyCsvSchema = z.object({
    agency_id: z.string(),
    agency_name: z.string(),
    agency_url: z.string(),
    agency_timezone: z.string(),
    agency_lang: z.string(),
    agency_phone: z.string(),
    agency_noc: z.string(),
});

program
    .option("-f, --file <file>", "Path to agencies csv file")
    .action(async (options) => {
        const { file } = await withUserPrompts(options, {
            file: { type: "input" },
        });

        const json = csvToJson.fieldDelimiter(",").supportQuotedField(true).getJsonFromCsv(file);

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
    })
    .parse();
