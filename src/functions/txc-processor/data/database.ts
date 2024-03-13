import { logger } from "@baselime/lambda-logger";
import { Agency, Database, NewRoute, getRouteTypeFromServiceMode, notEmpty } from "@bods-integrated-data/shared";
import { Operator, Service } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";

export const insertAgencies = async (dbClient: Kysely<Database>, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const existingAgency = await dbClient
            .selectFrom("agency")
            .selectAll()
            .where("noc", "=", operator.NationalOperatorCode)
            .executeTakeFirst();

        return dbClient
            .insertInto("agency_new")
            .values(
                existingAgency || {
                    name: operator.OperatorShortName,
                    noc: operator.NationalOperatorCode,
                    url: "",
                    registered_operator_ref: operator["@_id"],
                },
            )
            .onConflict((oc) => oc.column("noc").doUpdateSet({ name: operator.OperatorShortName }))
            .returningAll()
            .executeTakeFirst();
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};

export const insertRoutes = async (dbClient: Kysely<Database>, services: Service[], agencyData: Agency[]) => {
    const routePromises = services.flatMap((service) => {
        const routeType = getRouteTypeFromServiceMode(service.Mode);

        return service.Lines.Line.map(async (line) => {
            const existingRoute = await dbClient
                .selectFrom("route")
                .selectAll()
                .where("line_id", "=", line["@_id"])
                .executeTakeFirst();

            const agency = agencyData.find(
                (agency) => agency.registered_operator_ref === service.RegisteredOperatorRef,
            );

            if (!agency) {
                logger.warn(`Unable to find agency with registered operator ref: ${service.RegisteredOperatorRef}`);
                return null;
            }

            const newRoute: NewRoute = {
                agency_id: agency.id,
                route_short_name: line.LineName,
                route_long_name: "",
                route_type: routeType,
                line_id: line["@_id"],
            };

            return dbClient
                .insertInto("route_new")
                .values(existingRoute || newRoute)
                .onConflict((oc) =>
                    oc.column("line_id").doUpdateSet({ route_short_name: line.LineName, route_type: routeType }),
                )
                .returningAll()
                .executeTakeFirst();
        });
    });

    const routeData = await Promise.all(routePromises);

    return routeData.filter(notEmpty);
};
