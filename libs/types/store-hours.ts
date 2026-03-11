/**
 * Store hours per day. Keys are day of week: "0" = Sunday, "1" = Monday, ... "6" = Saturday.
 * null = closed that day.
 */
export interface StoreHoursDay {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

export type StoreHours = {
  [day: string]: StoreHoursDay | null;
};
