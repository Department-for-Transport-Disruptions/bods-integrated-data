import { createServerErrorResponse, createValidationErrorResponse } from "@bods-integrated-data/shared/api";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        exampleQueryParam: createStringLengthValidation("exampleQueryParam"),
    }),
);

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(
        z.object(
            {
                exampleBodyParam: createStringLengthValidation("exampleBodyParam"),
            },
            {
                message: "Body must be an object with required properties",
            },
        ),
    );

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { EXAMPLE_VAR: exampleVar } = process.env;

        if (!exampleVar) {
            throw new Error("Missing env vars - EXAMPLE_VAR must be set");
        }

        const { exampleQueryParam } = requestParamsSchema.parse(event.queryStringParameters);
        const { exampleBodyParam } = requestBodySchema.parse(event.body);

        logger.info("Executed lambda-http-template", { exampleVar, exampleQueryParam, exampleBodyParam });

        return {
            statusCode: 200,
            body: "",
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the lambda-http-template endpoint");
        }

        return createServerErrorResponse();
    }
};
