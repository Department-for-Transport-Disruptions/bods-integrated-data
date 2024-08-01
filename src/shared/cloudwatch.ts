import {
    CloudWatchClient,
    Dimension,
    GetMetricStatisticsCommand,
    MetricDatum,
    PutMetricDataCommand,
    Statistic,
} from "@aws-sdk/client-cloudwatch";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isDocker = process.env.IS_DOCKER;

const cloudwatchClient = new CloudWatchClient({
    region: "eu-west-2",
    ...(process.env.STAGE === "local"
        ? {
              endpoint:
                  localStackHost || isDocker ? "http://bods_integrated_data_localstack:4566" : "http://localhost:4566",
              forcePathStyle: true,
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
          }
        : {}),
});

export const putMetricData = async (namespace: string, metricData: MetricDatum[], metricDimensions?: Dimension[]) => {
    await cloudwatchClient.send(
        new PutMetricDataCommand({
            Namespace: namespace,
            MetricData: metricData,
            ...(metricDimensions ? { Dimensions: metricDimensions } : {}),
        }),
    );
};

export const getMetricStatistics = async (
    namespace: string,
    metricName: string,
    metricStatistics: Statistic[],
    startTime?: Date,
    endTime?: Date,
    period?: number,
    metricDimensions?: Dimension[],
) => {
    const data = await cloudwatchClient.send(
        new GetMetricStatisticsCommand({
            Namespace: namespace,
            MetricName: metricName,
            Dimensions: metricDimensions,
            StartTime: startTime,
            EndTime: endTime,
            Period: period,
            Statistics: metricStatistics,
        }),
    );

    return data;
};
