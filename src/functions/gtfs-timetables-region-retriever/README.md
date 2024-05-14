# GTFS Timetables Region Retriever Lambda Template

The purpose of this lambda is to return the available regions that have GTFS timetable files generated in S3. This is
then
consumed by the main BODS site in order to generate the required links to download each region's GTFS file.

This endpoint returns data in the following format:

```json
[
  {
    "regionCode": "L",
    "regionName": "London"
  },
  {
    "regionCode": "S",
    "regionName": "Scotland"
  }
]
```

If no region files are found then it returns an empty array.


