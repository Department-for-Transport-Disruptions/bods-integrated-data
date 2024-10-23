# Load testing

## Overview

Load testing is performed using [k6](https://k6.io/). First install k6: <https://grafana.com/docs/k6/latest/set-up/install-k6/>.

To learn more about using k6, visit the k6 docs: <https://grafana.com/docs/k6/latest/get-started/running-k6/>.

## Running tests

Pass the filename and any environment variables using the `-e` flag, for example:

```bash
k6 run -e API_KEY=load-5 avl-consumer-subscriptions.js
```
