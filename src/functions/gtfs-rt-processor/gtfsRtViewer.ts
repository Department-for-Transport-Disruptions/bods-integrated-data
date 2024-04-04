/* eslint-disable no-console */
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { readFileSync } from "node:fs";

const filename = process.argv[2] || "gtfs-rt";
console.log("reading file", filename);

const data = readFileSync(filename);
const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(data));

console.log("gtfs-rt feed", JSON.stringify(feed.toJSON(), null, 2));
