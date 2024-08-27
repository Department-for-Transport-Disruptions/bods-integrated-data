export const mockResponse = {
    feed_id: "411e4495-4a57-4d2f-89d5-cf105441f321",
    packet_count: 2,
    validation_summary: {
        total_error_count: 2,
        critical_error_count: 1,
        non_critical_error_count: 1,
        critical_score: 0.05,
        non_critical_score: 0.1,
        vehicle_activity_count: 2,
    },
    errors: [
        {
            header: {
                packet_name: "test",
                timestamp: "2024-03-11T00:00:00.000Z",
                feed_id: "411e4495-4a57-4d2f-89d5-cf105441f321",
            },
            errors: [
                {
                    level: "CRITICAL",
                    details: "Required",
                    identifier: {
                        line_ref: "ATB:Line:60",
                        name: "DestinationRef",
                        operator_ref: "123",
                        recorded_at_time: "2024-03-11T00:05:00.000Z",
                        vehicle_ref: "200141",
                    },
                },
                {
                    level: "NON-CRITICAL",
                    details: "Required",
                    identifier: {
                        line_ref: "ATB:Line:60",
                        name: "BlockRef",
                        operator_ref: "123",
                        recorded_at_time: "2024-03-11T00:05:00.000Z",
                        vehicle_ref: "200141",
                    },
                },
            ],
        },
    ],
};

export const mockResponseString = JSON.stringify(mockResponse);
