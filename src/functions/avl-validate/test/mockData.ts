import { AvlValidateRequestSchema } from "@bods-integrated-data/shared/schema/avl-validate.schema";

export const mockAvlValidateRequest: AvlValidateRequestSchema = {
    url: "https://mock-data-producer.com",
    username: "test-user",
    password: "dummy-password",
};

export const expectedCheckStatusRequestConfig = {
    headers: {
        Authorization: "Basic dGVzdC11c2VyOmR1bW15LXBhc3N3b3Jk",
        "Content-Type": "text/xml",
    },
};

export const expectedCheckStatusRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <CheckStatusRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <AccountId>BODS</AccountId>
    <RequestorRef>BODS</RequestorRef>
  </CheckStatusRequest>
</Siri>
`;

export const expectedCheckStatusRequestBodyWithCustomRequestorRef = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <CheckStatusRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <AccountId>BODS</AccountId>
    <RequestorRef>TEST-REF</RequestorRef>
  </CheckStatusRequest>
</Siri>
`;

export const mockCheckStatusResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <CheckStatusResponse>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <Status>true</Status>
  </CheckStatus>
</Siri>`;

export const mockCheckStatusResponseFalse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <CheckStatusResponse>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <Status>false</Status>
  </CheckStatus>
</Siri>`;
