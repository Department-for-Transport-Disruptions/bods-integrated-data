import { z } from "zod";
import { datetimeSchema } from "./misc.schema";

export const heartbeatNotificationSchema = z.object({
    Siri: z.object({
        HeartbeatNotification: z.object({
            RequestTimestamp: datetimeSchema,
            ProducerRef: z.string().optional(),
            Status: z.coerce.string(),
            ServiceStartedTime: datetimeSchema.optional(),
        }),
    }),
});

export type HeartbeatNotification = z.infer<typeof heartbeatNotificationSchema>;
