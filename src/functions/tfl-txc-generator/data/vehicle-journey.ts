import { BankHoliday, type DayJS, getDate } from "@bods-integrated-data/shared/dates";
import { OperatingProfileWithDateRange } from "@bods-integrated-data/shared/schema";

const parseDatesAndCreateSet = (dates: string[]) => {
    const parsedDates = dates.map((d) => getDate(d));
    const dateSet = new Set(parsedDates.map((d) => d.format("YYYY-MM-DD")));
    return { parsedDates, dateSet };
};

const calculateDayFrequency = (startDate: string, endDate: string, parsedDates: DayJS[]) => {
    const weekMap = new Map<string, Set<number>>();

    const start = getDate(startDate);
    const end = getDate(endDate);

    let current = start;

    while (current.isSameOrBefore(end)) {
        const weekStart = current.weekday(1).format("YYYY-MM-DD");

        if (!weekMap.has(weekStart)) {
            weekMap.set(weekStart, new Set<number>());
        }
        current = current.add(1, "week");
    }

    for (const d of parsedDates) {
        const weekStart = d.weekday(1).format("YYYY-MM-DD");
        const day = d.day();

        if (!weekMap.has(weekStart)) {
            weekMap.set(weekStart, new Set([day]));
        } else {
            weekMap.get(weekStart)?.add(day);
        }
    }

    const dayFrequency = new Map<number, number>();
    for (const days of weekMap.values()) {
        for (const day of days) {
            dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1);
        }
    }

    return { weekMap, dayFrequency };
};

const calculateRegularDaysOfOperation = (dayFrequency: Map<number, number>, totalWeeks: number) => {
    const threshold = Math.max(2, Math.floor(totalWeeks * 0.25));
    const regularDays = new Set<number>();

    for (const [day, frequency] of dayFrequency.entries()) {
        if (frequency >= threshold) {
            regularDays.add(day);
        }
    }

    return regularDays;
};

const identifyOrphanDates = (parsedDates: DayJS[], regularDays: Set<number>) => {
    const regularDateSet = new Set(
        parsedDates.filter((d) => regularDays.has(d.day())).map((d) => d.format("YYYY-MM-DD")),
    );

    return parsedDates.map((d) => d.format("YYYY-MM-DD")).filter((d) => !regularDateSet.has(d));
};

const categoriseBankHolidays = (
    bankHolidays: BankHoliday[],
    dateSet: Set<string>,
    regularDays: Set<number>,
    startDate: string,
    endDate: string,
) => {
    const serviceStart = getDate(startDate);
    const serviceEnd = getDate(endDate);
    const presentBankHolidays: BankHoliday[] = [];
    const missingBankHolidays: BankHoliday[] = [];

    for (const bh of bankHolidays) {
        const bhDate = getDate(bh.date);

        if (bhDate.isSameOrAfter(serviceStart) && bhDate.isSameOrBefore(serviceEnd)) {
            if (dateSet.has(bh.date.format("YYYY-MM-DD"))) {
                presentBankHolidays.push(bh);
            } else if (regularDays.has(bh.date.day())) {
                missingBankHolidays.push(bh);
            }
        }
    }

    return { presentBankHolidays, missingBankHolidays };
};

const findMissingRegularDates = (
    weekMap: Map<string, Set<number>>,
    regularDays: Set<number>,
    startDate: string,
    endDate: string,
) => {
    const missingDates: string[] = [];

    if (regularDays.size === 0) {
        return missingDates;
    }

    for (const [weekStart, actualDays] of weekMap.entries()) {
        const weekStartDate = getDate(weekStart);

        for (const regularDay of regularDays) {
            if (!actualDays.has(regularDay)) {
                const expectedDate = weekStartDate.day(regularDay);
                const expectedDateStr = expectedDate.format("YYYY-MM-DD");

                if (expectedDate.isSameOrAfter(getDate(startDate)) && expectedDate.isSameOrBefore(getDate(endDate))) {
                    missingDates.push(expectedDateStr);
                }
            }
        }
    }

    return missingDates;
};

const filterBankHolidaysFromSpecialDates = (dates: string[], bankHolidays: BankHoliday[]) => {
    const bankHolidayDates = new Set(bankHolidays.map((bh) => bh.date.format("YYYY-MM-DD")));

    return new Set(dates.filter((date) => !bankHolidayDates.has(date)));
};

const createRegularDayType = (regularDays: Set<number>): OperatingProfileWithDateRange["RegularDayType"] => {
    if (regularDays.size > 0) {
        return {
            DaysOfWeek: {
                Sunday: regularDays.has(0) ? "" : undefined,
                Monday: regularDays.has(1) ? "" : undefined,
                Tuesday: regularDays.has(2) ? "" : undefined,
                Wednesday: regularDays.has(3) ? "" : undefined,
                Thursday: regularDays.has(4) ? "" : undefined,
                Friday: regularDays.has(5) ? "" : undefined,
                Saturday: regularDays.has(6) ? "" : undefined,
            },
        };
    }

    return { HolidaysOnly: "" };
};

const createBankHolidayOperation = (
    presentBankHolidays: BankHoliday[],
    missingBankHolidays: BankHoliday[],
): OperatingProfileWithDateRange["BankHolidayOperation"] => {
    if (presentBankHolidays.length === 0 && missingBankHolidays.length === 0) {
        return undefined;
    }

    return {
        DaysOfOperation:
            presentBankHolidays.length > 0
                ? presentBankHolidays.reduce<Record<string, "">>((acc, holiday) => {
                      acc[holiday.name] = "";
                      return acc;
                  }, {})
                : undefined,
        DaysOfNonOperation:
            missingBankHolidays.length > 0
                ? missingBankHolidays.reduce<Record<string, "">>((acc, holiday) => {
                      acc[holiday.name] = "";
                      return acc;
                  }, {})
                : undefined,
    };
};

const createSpecialDaysOfOperation = (
    specialOperatingDates: Set<string>,
    specialNonOperatingDates: Set<string>,
): OperatingProfileWithDateRange["SpecialDaysOperation"] => {
    if (specialOperatingDates.size === 0 && specialNonOperatingDates.size === 0) {
        return undefined;
    }

    return {
        DaysOfOperation:
            specialOperatingDates.size > 0
                ? {
                      DateRange: Array.from(specialOperatingDates)
                          .sort()
                          .map((date) => ({
                              StartDate: date,
                              EndDate: date,
                          })),
                  }
                : undefined,
        DaysOfNonOperation:
            specialNonOperatingDates.size > 0
                ? {
                      DateRange: Array.from(specialNonOperatingDates)
                          .sort()
                          .map((date) => ({
                              StartDate: date,
                              EndDate: date,
                          })),
                  }
                : undefined,
    };
};

export const createOperatingProfile = (
    dates: string[],
    bankHolidays: BankHoliday[],
): OperatingProfileWithDateRange | undefined => {
    if (!dates.length) {
        return undefined;
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const { parsedDates, dateSet } = parseDatesAndCreateSet(dates);

    // Determine frequency that service runs on particular days of the week
    const { weekMap, dayFrequency } = calculateDayFrequency(startDate, endDate, parsedDates);

    const totalWeeks = weekMap.size;

    // Calculate recurring regular days of operation based on frequency
    const regularDays = calculateRegularDaysOfOperation(dayFrequency, totalWeeks);

    // Identify dates that don't fall into regular days of operation
    const orphanDates = identifyOrphanDates(parsedDates, regularDays);

    // Identify bank holidays that are present and those that are missing from regular days of operation
    const { presentBankHolidays, missingBankHolidays } = categoriseBankHolidays(
        bankHolidays,
        dateSet,
        regularDays,
        startDate,
        endDate,
    );

    // Find missing regular dates based on the week map and regular days of operation
    const missingDates = findMissingRegularDates(weekMap, regularDays, startDate, endDate);

    // Filter out bank holidays from the special dates
    const specialNonOperatingDates = filterBankHolidaysFromSpecialDates(missingDates, bankHolidays);
    const specialOperatingDates = filterBankHolidaysFromSpecialDates(orphanDates, bankHolidays);

    return {
        RegularDayType: createRegularDayType(regularDays),
        BankHolidayOperation: createBankHolidayOperation(presentBankHolidays, missingBankHolidays),
        SpecialDaysOperation: createSpecialDaysOfOperation(specialOperatingDates, specialNonOperatingDates),
    };
};
