import { siriSchema } from "@bods-integrated-data/shared/schema";
import { z } from "zod";

export const heartbeatNotificationSchema = z.object({
    HeartbeatNotification: z.object({
        RequestTimestamp: z.string(),
        ProducerRef: z.string().optional(),
        Status: z.coerce.string(),
        ServiceStartedTime: z.string().optional(),
    }),
});

export type HeartbeatNotification = z.infer<typeof heartbeatNotificationSchema>;

export const dataEndpointInputSchema = z.union([heartbeatNotificationSchema, siriSchema()]);
