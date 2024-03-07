import dayjs, { ManipulateType } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(timezone);
dayjs.extend(utc);

export const chunkArray = <T>(array: T[], chunkSize: number) => {
    const chunkArray = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        chunkArray.push(array.slice(i, i + chunkSize));
    }

    return chunkArray;
};

export const getDate = (input?: string) => (input ? dayjs.tz(input, "Europe/London") : dayjs().tz("Europe/London"));

export const addIntervalToDate = (date: string | Date, interval: number, intervalUnit: ManipulateType) =>
    dayjs.tz(date, "Europe/London").add(interval, intervalUnit);
