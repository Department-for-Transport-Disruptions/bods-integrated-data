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
    },
    {
        message: "Body must be an object with required properties",
    },
);

export type AvlValidateRequestSchema = z.infer<typeof avlValidateRequestSchema>;

export const avlServiceRequestSchema = z.object({
    ServiceRequest: z.object({
        RequestTimestamp: z.string(),
        RequestorRef: z.string(),
        VehicleMonitoringRequest: z.object({
            VehicleMonitoringRequest: z.object({
                RequestTimestamp: z.string(),
            }),
        }),
    }),
});

export const avlServiceDeliverySchema = z.object({
    ServiceDelivery: z.object({
        Status: z.coerce.string(),
    }),
    "@_version": z.string(),
});
