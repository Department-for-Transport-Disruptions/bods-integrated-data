## AVL Unsubscriber Lambda

### Overview

The purpose of this Lambda is to handle unsubscribing from a SIRI-VM AVL data producer.

For a given subscription it should:

- generate the SIRI-VM TerminateSubscriptionRequest message,
- send the message to the data producer
- Await TerminateSubscriptionResponse message, then validate that the Status field is `true`
- Update the AVL subscriptions table for that subscription to have the status of `TERMINATED`
- Remove the auth credentials for that subscription from parameter store

### Running locally

To run this function locally:

- Auth against AWS
- In the root directory run `make setup` (this will perform a `terraform apply` locally and will deploy
  the lambda function code in Localstack)
- If you have a valid subscription ID to hand skip this step. Otherwise, to create a mock data producer run the
  command `make create-avl-mock-data-producer`, navigate to DynamoDB in Localstack desktop the PK and copy the
  subscription ID of your mock data producer.
- Run the command
    ```makefile
    SUBSCRIPTION_ID=YOUR_SUBSCRIPTION_ID make invoke-local-avl-unsubscriber
    ```


