import { z } from "zod";

export const heartbeatNotificationSchema = z.object({
    Siri: z.object({
        HeartbeatNotification: z.object({
            RequestTimestamp: z.string().datetime({ offset: true }),
            ProducerRef: z.string().optional(),
            Status: z.coerce.string(),
            ServiceStartedTime: z.string().datetime({ offset: true }).optional(),
        }),
    }),
});

export type HeartbeatNotification = z.infer<typeof heartbeatNotificationSchema>;
