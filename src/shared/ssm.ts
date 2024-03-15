import { PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({
    region: "eu-west-2",
    ...(process.env.IS_LOCAL === "true"
        ? {
              endpoint: "http://localhost:4566",
          }
        : {}),
});

export const putParameter = async (
    name: string,
    value: string,
    type: "String" | "StringList" | "SecureString",
    overwrite: boolean,
): Promise<void> => {
    await ssm.send(
        new PutParameterCommand({
            Name: name,
            Value: value,
            Type: type,
            Overwrite: overwrite,
        }),
    );
};
