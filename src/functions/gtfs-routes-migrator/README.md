# GTFS Routes Migrator

The purpose of the GTFS routes migrator is to preserve GTFS route IDs by migrating the live dataset into the data warehouse.

Ingested routes are matched with existing routes using a combination of:

- line name (route_short_name)
- noc (noc from the agency table)
- region (to further scope down a route, since noc and line name can match to multiple routes when the routes belong to multiple regions)

Not all routes will be matched, in which case unmatched live dataset routes will still be imported, and data warehouse routes will be preserved.
To avoid route IDs conflicts, unmatched data warehouse route IDs will be incremented to above the highest live dataset route ID.

## Migration steps

1. Create database backup tables for routes and trips in case the table data needs reverting as part of exception handling
2. Fetch all database routes with multiple regions (based on noc + lineName) to:
   1. Create a DB route map to efficiently lookup routes using noc + lineName + region
3. Fetch all database routes to:
   1. Update the DB route map to efficiently lookup routes using noc + lineName when there isn't a region match (implies routes is in a single region)
   2. Keep track of unmatched routes so they can be reinserted into the database with incremented IDs
4. Fetch all database agencies to:
   1. Create a DB agency map to efficiently lookup agencies using noc, since we want to retain our agency IDs instead of the live dataset IDs
   2. Keep track of unmatched agencies - there should not be any, so if there are any then the agencies can checked manually
5. Fetch all database trips to:
   1. Create a DB trip match to efficiently lookup trips by route_id
   2. update all route_id references with new route IDs after the new routes have been processed
6. Create a new route map to:
   1. Keep track of matched routes and avoid storing duplicate matches
7. For each region, fetch GTFS data and match routes:
   1. Get agency.txt and routes.txt CSV files and store data in arrays
   2. Filter out agencies with missing nocs, since they won't be matched to data warehouse agency IDs
   3. Filter out routes with missing agency IDs, since they won't be matched to any live dataset agency IDs
   4. Create a GTFS agency map to efficiently lookup agencies using agency ID
   5. For each route:
      1. Use the route agency_id to lookup the noc in the GTFS agency map
      2. Use the noc + lineName to lookup the route in the DB route map
      3. If there is a route match:
         1. Mark the existing route as matched so that we can filter for unmatched routes later
         2. Overwrite the existing route ID with the new route ID and add the route to the new route map
      4. Otherwise:
         1. Create a new route with the live dataset route data and add it to the new route map
8. Calculate the existing route ID increment from the highest matched route ID and lowest existing route ID
9. Extract the unmatched routes into a list and increment all route IDs with the calculated increment value
10. Update the DB trip map with the updated route IDs
11. Combine all routes into one list and sort by ID ascending so that the latest inserted routes have the highest IDs
12. Truncate the existing route table and insert all routes
13. Truncate the existing trip table and insert all trips
