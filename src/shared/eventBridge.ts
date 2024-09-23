import {
    CreateScheduleCommand,
    CreateScheduleCommandInput,
    DeleteScheduleCommand,
    DeleteScheduleCommandInput,
    SchedulerClient,
} from "@aws-sdk/client-scheduler";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const client = new SchedulerClient({
    region: "eu-west-2",
    ...(process.env.STAGE === "local"
        ? {
              endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
          }
        : {}),
});

export const createSchedule = async (input: CreateScheduleCommandInput) => {
    const response = await client.send(new CreateScheduleCommand(input));

    if (!response.ScheduleArn) {
        throw new Error(`Error creating schedule: ${input.Name}`);
    }

    return response.ScheduleArn;
};

export const deleteSchedule = (input: DeleteScheduleCommandInput) => {
    return client.send(new DeleteScheduleCommand(input));
};
