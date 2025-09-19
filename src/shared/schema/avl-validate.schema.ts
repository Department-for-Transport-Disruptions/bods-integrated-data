import { z } from "zod";
import { createStringLengthValidation } from "../validation";

export const avlValidateRequestSchema = z.object(
    {
        url: z
            .string({
                required_error: "url is required",
                invalid_type_error: "url must be a string",
            })
            .url({
                message: "url must be a valid URL",
            }),
        username: createStringLengthValidation("username"),
        password: createStringLengthValidation("password"),
        requestorRef: z.string().trim().optional(),
    },
    {
        message: "Body must be an object with required properties",
    },
);

export type AvlValidateRequestSchema = z.infer<typeof avlValidateRequestSchema>;

export const avlCheckStatusRequestSchema = z.object({
    Siri: z.object({
        CheckStatusRequest: z.object({
            RequestTimestamp: z.string(),
            AccountId: z.string(),
            RequestorRef: z.string(),
        }),
    }),
});

export type AvlCheckStatusRequest = z.infer<typeof avlCheckStatusRequestSchema>;

export const avlCheckStatusResponseSchema = z.object({
    Siri: z.object({
        CheckStatusResponse: z.object({
            Status: z.coerce.string(),
        }),
        "@_version": z.string(),
    }),
});
