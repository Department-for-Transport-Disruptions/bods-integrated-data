import { Stream } from "node:stream";
import { Entry, Parse } from "unzipper";
import { startS3Upload } from "./s3";

export const getFilePath = (filePathWithFile: string) => {
    const path = filePathWithFile.substring(0, filePathWithFile.lastIndexOf("."));

    if (!path) {
        return "";
    }

    return `${path}/`;
};

export const unzip = async (object: Stream, unzippedBucketName: string, key: string) => {
    const zip = object.pipe(
        Parse({
            forceStream: true,
        }),
    );

    const promises = [];

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        const type = entry.type;

        if (type === "File") {
            let upload: ReturnType<typeof startS3Upload>;

            if (fileName.endsWith(".zip")) {
                await unzip(entry, unzippedBucketName, `${getFilePath(key)}${fileName}`);
            } else if (fileName.endsWith(".xml")) {
                upload = startS3Upload(unzippedBucketName, `${getFilePath(key)}${fileName}`, entry, "application/xml");
                promises.push(upload.done());
            }
        }

        entry.autodrain();
    }

    await Promise.all(promises);
};
