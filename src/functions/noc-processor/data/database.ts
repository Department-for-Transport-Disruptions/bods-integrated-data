import { KyselyDb, NewNocOperator } from "@bods-integrated-data/shared/database";
import { NocTableRecord } from "@bods-integrated-data/shared/schema";

export const insertNocOperator = async (dbClient: KyselyDb, nocRecords: NocTableRecord[]) => {
    const records = nocRecords.map((record): NewNocOperator => {
        return {
            noc: record.NOCCODE,
            operator_public_name: record.OperatorPublicName,
            vosa_psv_license_name: record.VOSA_PSVLicenseName,
            op_id: record.OpId,
            pub_nm_id: record.PubNmId,
        };
    });

    await dbClient.insertInto("noc_operator_new").values(records).execute();
};
