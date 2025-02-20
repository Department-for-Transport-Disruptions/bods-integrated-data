import axios, { AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLineIds } from "./index";

describe("getLineIds", () => {
    vi.mock("axios");
    const mockedAxios = vi.mocked(axios, true);

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("should return an array of line IDs if API returns data", async () => {
        const apiResponse = [
            {
                $type: "Tfl.Api.Presentation.Entities.Line, Tfl.Api.Presentation.Entities",
                id: "1",
                name: "1",
                modeName: "bus",
                disruptions: [],
                created: "2024-05-14T14:35:06.63Z",
                modified: "2024-05-14T14:35:06.63Z",
                lineStatuses: [],
                routeSections: [],
                serviceTypes: [
                    {
                        $type: "Tfl.Api.Presentation.Entities.LineServiceTypeInfo, Tfl.Api.Presentation.Entities",
                        name: "Regular",
                        uri: "/Line/Route?ids=1&serviceTypes=Regular",
                    },
                ],
                crowding: {
                    $type: "Tfl.Api.Presentation.Entities.Crowding, Tfl.Api.Presentation.Entities",
                },
            },
            {
                $type: "Tfl.Api.Presentation.Entities.Line, Tfl.Api.Presentation.Entities",
                id: "100",
                name: "100",
                modeName: "bus",
                disruptions: [],
                created: "2024-05-14T14:35:06.63Z",
                modified: "2024-05-14T14:35:06.63Z",
                lineStatuses: [],
                routeSections: [],
                serviceTypes: [
                    {
                        $type: "Tfl.Api.Presentation.Entities.LineServiceTypeInfo, Tfl.Api.Presentation.Entities",
                        name: "Regular",
                        uri: "/Line/Route?ids=100&serviceTypes=Regular",
                    },
                ],
                crowding: {
                    $type: "Tfl.Api.Presentation.Entities.Crowding, Tfl.Api.Presentation.Entities",
                },
            },
        ];

        mockedAxios.get.mockResolvedValue({
            data: apiResponse,
            status: 200,
        } as AxiosResponse);

        expect(await getLineIds()).toEqual(["1", "100"]);
    });

    it("should return an empty array if empty response is returned from API", async () => {
        const apiResponse: [] = [];

        mockedAxios.get.mockResolvedValue({
            data: apiResponse,
            status: 200,
        } as AxiosResponse);

        expect(await getLineIds()).toEqual(apiResponse);
    });

    it("should throw an error if an error is return from the API", async () => {
        mockedAxios.get.mockRejectedValue(new Error());

        await expect(getLineIds()).rejects.toThrowError();
    });
});
