import { CreateScheduleCommand, CreateScheduleCommandInput, SchedulerClient } from "@aws-sdk/client-scheduler";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isLocal = process.env.STAGE === "local";

const client = new SchedulerClient({
    endpoint: localStackHost ? `http://${localStackHost}:4566` : isLocal ? "http://localhost:4566" : undefined,
    region: "eu-west-2",
});

export const createSchedule = async (input: CreateScheduleCommandInput) => {
    const response = await client.send(new CreateScheduleCommand(input));

    if (!response.ScheduleArn) {
        throw new Error(`Error creating schedule: ${input.Name}`);
    }

    return response.ScheduleArn;
};
