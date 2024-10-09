import { check } from "k6";
import exec from "k6/execution";
import http from "k6/http";

const SMALL_PRODUCER_SUBSCRIPTION_ID = "14964"; // ensure that this subscription exists and that it produces a small amount of vehicle activities.
const LARGE_PRODUCER_SUBSCRIPTION_ID = "3492"; // ensure that this subscription exists and that it produces a large amount of vehicle activities.
const LARGE_PRODUCER_PERCENTAGE = 0.25;

const vuCount = 3;
const iterationPerVuCount = 1000;
const iterationCount = vuCount * iterationPerVuCount;
const largeProducerCutOffIteration = iterationCount * LARGE_PRODUCER_PERCENTAGE;

const headers = {
    "Content-Type": "text/xml",
    "x-user-id": __ENV.USER_ID,
};

export const options = {
    cloud: {
        distribution: {
            "amazon:gb:london": { loadZone: "amazon:gb:london", percent: 100 },
        },
    },
    thresholds: {},
    scenarios: {
        subscribe_scenario: {
            exec: "subscribe_scenario",
            executor: "per-vu-iterations",
            vus: vuCount,
            iterations: iterationPerVuCount,
            startTime: "0s",
            gracefulStop: "30s",
        },
        unsubscribe_scenario: {
            exec: "unsubscribe_scenario",
            executor: "per-vu-iterations",
            vus: vuCount,
            iterations: iterationPerVuCount,
            startTime: "15m",
            gracefulStop: "30s",
        },
    },
};

export function subscribe_scenario() {
    const subscriptionId = `load-${exec.scenario.iterationInTest}`;

    const producerSubscriptionId =
        exec.scenario.iterationInTest <= largeProducerCutOffIteration
            ? LARGE_PRODUCER_SUBSCRIPTION_ID
            : SMALL_PRODUCER_SUBSCRIPTION_ID;

    const url = `https://ya6tiqlzae.execute-api.eu-west-2.amazonaws.com/v1/siri-vm/subscribe?subscriptionId=${producerSubscriptionId}`;

    const body = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd">
  <SubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <ConsumerAddress>https://yyv9ddfk4c.execute-api.eu-west-2.amazonaws.com/data</ConsumerAddress>
    <RequestorRef>load-test</RequestorRef>
    <MessageIdentifier>1234</MessageIdentifier>
    <SubscriptionContext>
      <HeartbeatInterval>PT30S</HeartbeatInterval>
    </SubscriptionContext>
    <VehicleMonitoringSubscriptionRequest>
      <SubscriptionIdentifier>${subscriptionId}</SubscriptionIdentifier>
      <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
      <VehicleMonitoringRequest version="2.0">
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
        <VehicleMonitoringDetailLevel>normal</VehicleMonitoringDetailLevel>
      </VehicleMonitoringRequest>
      <UpdateInterval>PT10S</UpdateInterval>
    </VehicleMonitoringSubscriptionRequest>
  </SubscriptionRequest>
</Siri>
`;

    const response = http.post(url, body, { headers });
    check(response, { "response code was 200": (res) => res.status === 200 });
}

export function unsubscribe_scenario() {
    const subscriptionId = `load-${exec.scenario.iterationInTest}`;

    const url = "https://ya6tiqlzae.execute-api.eu-west-2.amazonaws.com/v1/siri-vm/unsubscribe";

    const body = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd">
  <TerminateSubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <RequestorRef>consumer-test</RequestorRef>
    <MessageIdentifier>1234</MessageIdentifier>
    <SubscriptionRef>${subscriptionId}</SubscriptionRef>
  </TerminateSubscriptionRequest>
</Siri>`;

    const response = http.post(url, body, { headers });
    check(response, { "response code was 204": (res) => res.status === 204 });
}
