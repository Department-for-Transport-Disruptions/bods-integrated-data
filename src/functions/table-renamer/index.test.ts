import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { describe, it, expect, vi } from "vitest";
import { TableKey, checkTables, renameTables } from ".";

const mockExecute = vi.fn().mockResolvedValue([{ count: 100 }]);
const mockSchema = {
    dropTable: vi.fn().mockReturnThis(),
    ifExists: vi.fn().mockReturnThis(),
    cascade: vi.fn().mockReturnThis(),
    alterTable: vi.fn().mockReturnThis(),
    renameTo: vi.fn().mockReturnThis(),
    execute: mockExecute,
};

describe("table renamer", () => {
    vi.mock("@bods-integrated-data/shared/database", () => ({
        getDatabaseClient: vi.fn(() => ({
            selectFrom: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            execute: mockExecute,
            schema: mockSchema,
            destroy: vi.fn(),
            fn: {
                count: vi.fn().mockReturnThis(),
                as: vi.fn(),
            },
        })),
    }));

    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    const tables: TableKey[] = [{ table: "agency", newTable: "agency_new", key: "id" }];

    describe("getMatchingTables", () => {
        it("should not throw an error with valid percentages", async () => {
            const dbClient = await getDatabaseClient(true);

            await expect(checkTables(dbClient, tables)).resolves.not.toThrowError();
        });

        it("should throw an error if match percentage is less than 80%", async () => {
            const dbClient = await getDatabaseClient(true);
            mockExecute.mockResolvedValueOnce([{ count: 50 }]);

            await expect(checkTables(dbClient, tables)).rejects.toThrowError(
                "Tables agency and agency_new have less than an 80% match, percentage match: 50%",
            );
        });

        it("should throw an error if new table is empty", async () => {
            const dbClient = await getDatabaseClient(true);
            mockExecute.mockResolvedValueOnce([{ count: 0 }]);

            await expect(checkTables(dbClient, tables)).rejects.toThrowError("No data found in table agency_new");
        });

        it("should skip percentage check if current table is empty", async () => {
            const dbClient = await getDatabaseClient(true);
            mockExecute.mockResolvedValueOnce([{ count: 100 }]);
            mockExecute.mockResolvedValueOnce([{ count: 0 }]);

            await expect(checkTables(dbClient, tables)).resolves.not.toThrowError();
        });
    });

    describe("renameTables", () => {
        it("should drop the old table", async () => {
            const dbClient = await getDatabaseClient(true);
            await renameTables(dbClient, tables);

            expect(mockSchema.dropTable).toHaveBeenCalledWith("agency_old");
        });

        it("should rename the current table", async () => {
            const dbClient = await getDatabaseClient(true);
            await renameTables(dbClient, tables);

            expect(mockSchema.alterTable).toHaveBeenCalledWith("agency");
            expect(mockSchema.renameTo).toHaveBeenCalledWith("agency_old");
        });

        it("should rename the new table", async () => {
            const dbClient = await getDatabaseClient(true);
            await renameTables(dbClient, tables);

            expect(mockSchema.alterTable).toHaveBeenCalledWith("agency_new");
            expect(mockSchema.renameTo).toHaveBeenCalledWith("agency");
        });
    });
});
