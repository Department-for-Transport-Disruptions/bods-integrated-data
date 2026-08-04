# Load Testing

## Overview

Load testing is performed using [k6](https://k6.io/). All test scripts are configured to run from the `amazon:gb:london` load zone, making them suitable for execution via [Grafana Cloud k6](https://grafana.com/docs/grafana-cloud/testing/k6/).

To learn more about using k6, visit the k6 docs: <https://grafana.com/docs/k6/latest/get-started/running-k6/>.

## Prerequisites

Install k6: <https://grafana.com/docs/k6/latest/set-up/install-k6/>

For cloud runs, authenticate with Grafana Cloud:

```bash
k6 login cloud --token <your-grafana-cloud-token>
```

## Running tests

### Locally

Pass the filename and any required environment variables using the `-e` flag:

```bash
k6 run -e <EnvURL> <script>.js
```

### On Grafana Cloud

```bash
k6 cloud -e <EnvURL> <script>.js
```

---

## Test scripts

### `avl-consumer-subscriptions.js`

Load tests the AVL Consumer API subscription and unsubscription endpoints.

**Required environment variables**

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Base URL of the AVL Consumer API (e.g. `https://<api-id>.execute-api.eu-west-2.amazonaws.com/v1`) |
| `API_KEY` | API key sent as the `x-api-key` request header |

**Example**

```bash
k6 run -e BASE_URL=https://6tfu67dcng.execute-api.eu-west-2.amazonaws.com/v1 -e API_KEY=load-5 avl-consumer-subscriptions.js
```

**Scenarios**

| Scenario | Executor | VUs | Iterations per VU | Start time | What it does |
|----------|----------|-----|-------------------|------------|--------------|
| `subscribe_scenario` | `per-vu-iterations` | 3 | 1 000 | 0s | `POST /siri-vm/subscriptions` — creates 3 000 consumer subscriptions. The first 25% target a large-data producer, the remainder a small-data producer |
| `unsubscribe_scenario` | `per-vu-iterations` | 3 | 1 000 | 15m | `DELETE /siri-vm/subscriptions` — unsubscribes all 3 000 subscriptions created in the subscribe phase |

> **Note:** The 15-minute gap between subscribe and unsubscribe gives the SQS event source mappings time to be created before teardown.

**Subscription IDs used**

- Small-data producer: `14964`
- Large-data producer: `3492` (used for the first 25% of iterations)

---

### `siri-vm-downloader.js`

Load tests the SIRI-VM data endpoint across a range of query patterns using ramping virtual users.

**Required environment variables**

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Base URL of the AVL Consumer API (e.g. `https://<api-id>.execute-api.eu-west-2.amazonaws.com/v1`) |

**Example**

```bash
k6 run -e BASE_URL=https://6tfu67dcng.execute-api.eu-west-2.amazonaws.com/v1 siri-vm-downloader.js
```

**Scenarios**

Each scenario ramps from 0 → 30 VUs over 1 minute, holds at 50 VUs for 3.5 minutes, then ramps back to 0 over 30 seconds. Scenarios run sequentially, offset by 5-minute intervals.

| Scenario | Start time | Endpoint called |
|----------|------------|-----------------|
| `worst_case_scenario` | 0m | `GET /siri-vm?boundingBox=-13.43…,48.67…,4.27…,59.53…` (whole GB bounding box) |
| `no_query_params_scenario` | 5m | `GET /siri-vm` |
| `small_bounding_box_scenario` | 10m | `GET /siri-vm?boundingBox=-1.67…,53.74…,-1.41…,53.88…` (Leeds area) |
| `large_bounding_box_scenario` | 15m | `GET /siri-vm?boundingBox=-2.86…,52.27…,-0.49…,54.74…` (Yorkshire/Midlands) |
| `operator_ref_scenario` | 20m | `GET /siri-vm?operatorRef=WDBC` |

**Total duration:** ~25 minutes

---

### `gtfs-rt-downloader.js`

Load tests the GTFS-RT data endpoint across the same bounding-box patterns used by `siri-vm-downloader.js`.

**Required environment variables**

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Base URL of the GTFS-RT Consumer API (e.g. `https://<api-id>.execute-api.eu-west-2.amazonaws.com/v1`) |

**Example**

```bash
k6 run -e BASE_URL=https://<api-id>.execute-api.eu-west-2.amazonaws.com/v1 gtfs-rt-downloader.js
```

**Scenarios**

Same ramp profile as `siri-vm-downloader.js` (0 → 30 → 50 → 0 VUs). Scenarios run sequentially offset by 5 minutes.

| Scenario | Start time | Endpoint called |
|----------|------------|-----------------|
| `worst_case_scenario` | 0m | `GET /gtfs-rt?startTimeAfter=1` |
| `no_query_params_scenario` | 5m | `GET /gtfs-rt` |
| `small_bounding_box_scenario` | 10m | `GET /gtfs-rt?boundingBox=-1.67…,53.74…,-1.41…,53.88…` (Leeds area) |
| `large_bounding_box_scenario` | 15m | `GET /gtfs-rt?boundingBox=-2.86…,52.27…,-0.49…,54.74…` (Yorkshire/Midlands) |

**Total duration:** ~20 minutes

---

## Clearing the AVL consumer queues

After a load test run you may need to purge the consumer subscriptions, SQS queues, and CloudWatch alarms that were created. The `avl_consumer_cleardown.sh` script does this automatically.

Log in to the AWS profile first:

```bash
aws sso login --profile bods-non-prod
```

If that doesn't pick up, export the profile explicitly:

```bash
export AWS_PROFILE="bods-non-prod"
```

Make the script executable (first run only):

```bash
chmod +x avl_consumer_cleardown.sh
```

Then run it from the `load-testing/` directory:

```bash
./avl_consumer_cleardown.sh
```

---

## Project structure

```
load-testing/
├── avl-consumer-subscriptions.js   # Subscribe/unsubscribe load test for AVL Consumer API
├── siri-vm-downloader.js           # SIRI-VM endpoint load test (ramping VUs, multiple query patterns)
├── gtfs-rt-downloader.js           # GTFS-RT endpoint load test (ramping VUs, multiple query patterns)
├── avl_consumer_cleardown.sh       # Clears consumer subscriptions, SQS queues and CloudWatch alarms
└── README.md
```
