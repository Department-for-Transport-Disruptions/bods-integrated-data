export const generateMockHeartbeat = (
    subscriptionId: string,
    currentTime: string,
) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns:ns3="http://www.ifopt.org.uk/ifopt" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0">
    <HeartbeatNotification>
        <RequestTimestamp>${currentTime}</RequestTimestamp>
        <ProducerRef>${subscriptionId}</ProducerRef>
        <Status>true</Status>
        <ServiceStartedTime>${currentTime}</ServiceStartedTime>
    </HeartbeatNotification>
</Siri>`;
