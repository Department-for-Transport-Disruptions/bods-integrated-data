import { DeleteParameterCommand, DeleteParametersCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const ssm = new SSMClient({
    region: "eu-west-2",
    ...(process.env.IS_LOCAL === "true"
        ? {
              endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
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

export const deleteParameters = async (names: string[]): Promise<void> => {
    await ssm.send(
        new DeleteParametersCommand({
            Names: names,
        }),
    );
};
