import { sleep } from "k6";
import http from "k6/http";

export const options = {
    cloud: {
        distribution: {
            "amazon:gb:london": { loadZone: "amazon:gb:london", percent: 100 },
        },
    },
    thresholds: {},
    scenarios: {
        worst_case_scenario: {
            executor: "ramping-vus",
            gracefulStop: "30s",
            stages: [
                { target: 30, duration: "1m" },
                { target: 50, duration: "3.5m" },
                { target: 0, duration: "30s" },
            ],
            gracefulRampDown: "30s",
            exec: "worst_case_scenario",
        },
        no_query_params_scenario: {
            executor: "ramping-vus",
            gracefulStop: "30s",
            stages: [
                { target: 30, duration: "1m" },
                { target: 50, duration: "3.5m" },
                { target: 0, duration: "30s" },
            ],
            gracefulRampDown: "30s",
            startTime: "5m",
            exec: "no_query_params_scenario",
        },
        small_bounding_box_scenario: {
            executor: "ramping-vus",
            gracefulStop: "30s",
            stages: [
                { target: 30, duration: "1m" },
                { target: 50, duration: "3.5m" },
                { target: 0, duration: "30s" },
            ],
            gracefulRampDown: "30s",
            startTime: "10m",
            exec: "small_bounding_box_scenario",
        },
        large_bounding_box_scenario: {
            executor: "ramping-vus",
            gracefulStop: "30s",
            stages: [
                { target: 30, duration: "1m" },
                { target: 50, duration: "3.5m" },
                { target: 0, duration: "30s" },
            ],
            gracefulRampDown: "30s",
            startTime: "15m",
            exec: "large_bounding_box_scenario",
        },
        operator_ref_scenario: {
            executor: "ramping-vus",
            gracefulStop: "30s",
            stages: [
                { target: 30, duration: "1m" },
                { target: 50, duration: "3.5m" },
                { target: 0, duration: "30s" },
            ],
            gracefulRampDown: "30s",
            startTime: "20m",
            exec: "operator_ref_scenario",
        },
    },
};

export function no_query_params_scenario() {
    http.get(`${__ENV.BASE_URL}/siri-vm`);

    // Automatically added sleep
    sleep(1);
}

export function small_bounding_box_scenario() {
    http.get(`${__ENV.BASE_URL}/siri-vm?boundingBox=-1.673184,53.742988,-1.409340,53.878402`);

    // Automatically added sleep
    sleep(1);
}

export function large_bounding_box_scenario() {
    http.get(`${__ENV.BASE_URL}/siri-vm?boundingBox=-2.864250,52.267527,-0.489651,54.736713`);

    // Automatically added sleep
    sleep(1);
}

export function operator_ref_scenario() {
    http.get(`${__ENV.BASE_URL}/siri-vm?operatorRef=WDBC`);

    // Automatically added sleep
    sleep(1);
}

export function worst_case_scenario() {
    http.get(`${__ENV.BASE_URL}/siri-vm?boundingBox=-13.4348744717,48.6679710556,4.2671070956,59.5344534076`);

    // Automatically added sleep
    sleep(1);
}
