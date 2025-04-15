import { createReadStream, readFileSync } from "node:fs";
import { Parser } from "node-expat";
import { describe, it } from "vitest";
import { parseXml as ownParseXml } from ".";

describe("xml parsing", () => {
    it("should parse XML correctly", () => {
        const xml = readFileSync("NaPTAN.xml", "utf-8");
        const parsedXml = ownParseXml(xml);
    });

    // it("should parse with the new xml parser", () => {
    //     const xml = readFileSync("NaPTAN.xml", "utf-8");
    //     const parsedXml = parseXml(xml);
    //     writeFileSync("parsed.xml", JSON.stringify(parsedXml, null, 2));
    // });

    it("should parse with the new xml parser", async () => {
        const readStream = createReadStream("038.xml", { encoding: "utf-8" });
        const parser = new Parser("UTF-8");

        // const parsedXml: any = {};
        // parser.on("startElement", (name, attrs) => {
        //     console.log("Start element:", name, attrs);
        // });
        // parser.on("endElement", (name) => {
        //     console.log("End element:", name);
        // });
        // parser.on("text", (text) => {
        //     console.log("Text:", text.trim());
        // });
        parser.on("error", (error) => {
            console.error("Error:", error);
        });
        parser.on("end", (x) => {
            console.log("Parsing finished");
            console.log(x);
            // const data = naptanSchemaTransformed.parse(parsedXml);
            // console.log(data);

            // writeFileSync("NaPTAN.json", JSON.stringify(parsedXml, null, 2));
            // writeFileSync("NaPTAN.json", JSON.stringify(data, null, 2));
        });

        for await (const chunk of readStream) {
            // parser.write(chunk);
            parser.parse(chunk, false);
        }
        parser.parse("", true);

        // await new Promise((resolve) => setTimeout(resolve, 5000));
    });
});
