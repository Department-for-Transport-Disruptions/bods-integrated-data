import { z } from "zod";
import {
    affectedLineSchema,
    affectedOperatorSchema,
    affectedStopPointsSchema,
    affectsSchema,
    callsSchema,
    consequenceSchema,
    consequencesSchema,
    facilitiesSchema,
    infoLinkSchema,
    infoLinksSchema,
    journeyPartsSchema,
    journeysSchema,
    networksSchema,
    operatorsSchema,
    periodSchema,
    ptSituationElementSchema,
    referenceSchema,
    repetitionsSchema,
    siriSxSchema,
    situationElementRefSchema,
    sourceSchema,
} from "./siriSxTypes.zod";

export type Source = z.infer<typeof sourceSchema>;
export type Period = z.infer<typeof periodSchema>;
export type InfoLink = z.infer<typeof infoLinkSchema>;
export type SituationElementRef = z.infer<typeof situationElementRefSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Repetitions = z.infer<typeof repetitionsSchema>;
export type InfoLinks = z.infer<typeof infoLinksSchema>;
export type AffectedOperator = z.infer<typeof affectedOperatorSchema>;
export type Operators = z.infer<typeof operatorsSchema>;
export type AffectedLine = z.infer<typeof affectedLineSchema>;
export type Networks = z.infer<typeof networksSchema>;
export type AffectedStopPoints = z.infer<typeof affectedStopPointsSchema>;
export type Calls = z.infer<typeof callsSchema>;
export type Facilities = z.infer<typeof facilitiesSchema>;
export type JourneyParts = z.infer<typeof journeyPartsSchema>;
export type Journeys = z.infer<typeof journeysSchema>;
export type Affects = z.infer<typeof affectsSchema>;
export type Consequence = z.infer<typeof consequenceSchema>;
export type Consequences = z.infer<typeof consequencesSchema>;
export type PtSituationElement = z.infer<typeof ptSituationElementSchema>;
export type SiriSx = z.infer<ReturnType<typeof siriSxSchema>>;
