import {
    CloudWatchClient,
    Dimension,
    GetMetricStatisticsCommand,
    MetricDatum,
    PutMetricDataCommand,
    Statistic,
} from "@aws-sdk/client-cloudwatch";
import {
    CloudWatchLogsClient,
    GetQueryResultsCommand,
    GetQueryResultsCommandOutput,
    StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";

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

const cloudwatchLogsClient = new CloudWatchLogsClient({
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

const pollQueryResults = async (queryId: string | undefined, interval = 1000) => {
    let queryResults: GetQueryResultsCommandOutput;
    let queryStatus: string | undefined;

    do {
        queryResults = await cloudwatchLogsClient.send(
            new GetQueryResultsCommand({
                queryId,
            }),
        );

        queryStatus = queryResults.status;
        if (queryStatus === "Running" || queryStatus === "Scheduled") {
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    } while (queryStatus === "Running" || queryStatus === "Scheduled");

    return queryResults.results;
};

export const runLogInsightsQuery = async (
    logGroupName: string,
    startTime: number,
    endTime: number,
    queryString: string,
) => {
    const logQuery = await cloudwatchLogsClient.send(
        new StartQueryCommand({
            logGroupName,
            startTime,
            endTime,
            queryString,
        }),
    );

    return await pollQueryResults(logQuery.queryId);
};
