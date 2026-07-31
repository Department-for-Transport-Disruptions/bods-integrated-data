# Integration Testing

## Overview

Integration tests for the BODS Integrated Data platform. Tests are written using [Playwright](https://playwright.dev/) and exercise live AWS-backed APIs in the `dev` or `test` environments.

The tests require valid AWS credentials configured for the `eu-west-2` region, as they interact directly with AWS services (DynamoDB, Secrets Manager, SQS, Lambda, EventBridge Scheduler, and CloudWatch) to set up and tear down test state.

## Prerequisites

- [pnpm](https://pnpm.io/) installed
- AWS credentials configured for `eu-west-2` with permissions to read Secrets Manager, and read/write DynamoDB, SQS, Lambda, EventBridge Scheduler, and CloudWatch

## Setup

Install dependencies from the workspace root:

```bash
pnpm install
```

## Running tests

Tests must target either the `dev` or `test` environment via the `STAGE` environment variable.

Run against the **dev** environment:

```bash
pnpm test:dev
```

Run against the **test** environment:

```bash
pnpm test:test
```

Run against a custom stage:

```bash
STAGE=<stage> pnpm test
```

> **Note:** Tests can only be run against `dev` or `test` environments. They will throw an error if run against any other stage.

## Type checking

```bash
pnpm check-types
```

## Test suites

### AVL Producer API (`tests/avl-producer-api.spec.ts`)

Tests the AVL Producer API at `https://avl-producer.<stage>.integrated-data.dft-create-data.com`.

The API key is fetched from AWS Secrets Manager before the suite runs. A test subscription is created fresh for each run and cleaned up afterwards.

| Test | Description |
|------|-------------|
| Creates a subscription | `POST /subscriptions` — expects `201` and the subscription to appear as `live` |
| Updates a subscription | `PUT /subscriptions/:id` — expects `204` and the subscription to remain `live` |
| Posts AVL data to the data endpoint | `POST /subscriptions/:id?apiKey=…` — sends a SIRI heartbeat and SIRI-VM payload, expects `200` and timestamps to be recorded on the subscription |
| Unsubscribes a subscription | `DELETE /subscriptions/:id` — expects `204` and the subscription status to change to `inactive` |

### AVL Consumer API (`tests/avl-consumer-api.spec.ts`)

Tests the AVL Consumer API (environment-specific URL resolved from `STAGE`).

A test producer subscription is seeded into DynamoDB before the suite runs. Any pre-existing consumer subscription is cleaned up beforehand, and both are removed afterwards.

| Test | Description |
|------|-------------|
| Returns SIRI-VM data (no query params) | `GET /siri-vm` — expects `200` |
| Returns SIRI-VM data (with query params) | `GET /siri-vm?<filters>` — expects `200` with filters for subscriptionId, name, operatorRef, lineRef, vehicleRef, producerRef, originRef, destinationRef, and boundingBox |
| Creates a consumer subscription | `POST /siri-vm/subscriptions` — sends a SIRI `SubscriptionRequest` XML body, expects `200` |
| Rejects an immediate unsubscribe | `DELETE /siri-vm/subscriptions` — expects `503` when called too soon after subscribing (the SQS event source mapping has not yet been created) |
| Unsubscribes a consumer subscription | `DELETE /siri-vm/subscriptions` — waits 15 seconds for the event source mapping to be ready, then expects `204` |

## Project structure

```
integration-testing/
├── data/
│   ├── mockHeartbeat.ts      # Generates SIRI XML HeartbeatNotification payloads
│   └── mockSiri.ts           # Generates SIRI-VM XML VehicleMonitoring payloads
├── tests/
│   ├── avl-consumer-api.spec.ts
│   └── avl-producer-api.spec.ts
├── utils/
│   ├── awsClients.ts         # AWS SDK client factories (eu-west-2)
│   └── index.ts              # DynamoDB, Secrets Manager, SQS, Lambda, Scheduler, CloudWatch helpers
├── playwright.config.ts
├── tsconfig.json
└── package.json
```
