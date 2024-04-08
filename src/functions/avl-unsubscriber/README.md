## AVL Unsubscriber Lambda

### Overview

The purpose of this Lambda is to handle unsubscribing from a SIRI-VM AVL data producer.

For a given subscription it should:

- generate the SIRI-VM TerminateSubscriptionRequest message,
- send the message to the data producer
- Await TerminateSubscriptionResponse message, then validate that the Status field is `true`
- Update the AVL subscriptions table for that subscription to have the status of `TERMINATED`
- Remove the auth credentials for that subscription from parameter store


