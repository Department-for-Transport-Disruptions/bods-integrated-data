import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { describe, it, expect, vi } from "vitest";
import { TableKey, getMatchingTables, renameTables } from ".";

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
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    const tables: TableKey[] = [{ table: "agency", newTable: "agency_new", key: "id" }];

    describe("getMatchingTables", () => {
        it("should return non-empty matching tables with valid percentages", async () => {
            const dbClient = await getDatabaseClient(true);
            const result = await getMatchingTables(dbClient, tables);

            expect(result).toContain("agency");
            expect(logger.warn).not.toBeCalled();
        });

        it("should log a warning if match percentage is less than 80%", async () => {
            const dbClient = await getDatabaseClient(true);
            mockExecute.mockResolvedValueOnce([{ count: 50 }]);
            await getMatchingTables(dbClient, tables);

            expect(logger.warn).toBeCalledWith(expect.stringContaining("less than an 80% match"));
        });
    });

    describe("renameTables", () => {
        it("should drop the old table", async () => {
            const dbClient = await getDatabaseClient(true);
            await renameTables(["agency"], dbClient);

            expect(mockSchema.dropTable).toHaveBeenCalledWith("agency_old");
        });

        it("should rename the current table", async () => {
            const dbClient = await getDatabaseClient(true);
            await renameTables(["agency"], dbClient);

            expect(mockSchema.alterTable).toHaveBeenCalledWith("agency");
            expect(mockSchema.renameTo).toHaveBeenCalledWith("agency_old");
        });

        it("should rename the new table", async () => {
            const dbClient = await getDatabaseClient(true);
            await renameTables(["agency"], dbClient);

            expect(mockSchema.alterTable).toHaveBeenCalledWith("agency_new");
            expect(mockSchema.renameTo).toHaveBeenCalledWith("agency");
        });
    });
});
