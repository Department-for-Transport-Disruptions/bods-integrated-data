# Aggregate SIRI-VM Function

Code for the AWS Lambda that is responsible for regularly querying the AVL database to retrieve the most recent vehicle 
location for each unique vehicle in the database and aggregate it into a single SIRI-VM file which is then uploaded to 
S3.

## Running Locally

To run this lambda locally, ensure you have first [followed the steps for setting up the local development environment.](../../../README.md)

If you have already set up your local environment, run `make setup` to ensure the required database migrations and S3 bucket has been created.

Ensure that your local database has some data in the AVL table.

Then run the following make command:

```bash
make run-avl-aggregate-siri
```
If successful there will be a `SIRI-VM.xml` file stored in your local S3 bucket. To verify this you can run:
```bash
awslocal s3 ls s3://avl-siri-vm-local
```

