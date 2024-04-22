import { z } from "zod";

const nptgAdminAreaSchema = z.object({
    AdministrativeAreaCode: z.string(),
    AtcoAreaCode: z.string(),
    Name: z.string(),
});

const nptgLocalitySchema = z.object({
    NptgLocalityCode: z.string(),
    AdministrativeAreaRef: z.string(),
});

const nptgRegionSchema = z.object({
    RegionCode: z.string(),
    Name: z.coerce.string(),
    AdministrativeAreas: z
        .object({
            AdministrativeArea: nptgAdminAreaSchema.array(),
        })
        .optional(),
});

export const nptgSchema = z.object({
    NationalPublicTransportGazetteer: z.object({
        Regions: z
            .object({
                Region: nptgRegionSchema.array(),
            })
            .optional(),
        NptgLocalities: z
            .object({
                NptgLocality: nptgLocalitySchema.array(),
            })
            .optional(),
    }),
});

export type NptgSchema = z.infer<typeof nptgSchema>;
