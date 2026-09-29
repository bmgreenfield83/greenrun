import type { Activity } from "../../api/activities";

export type ActivityListFilters = {
  sport: string;
  startDate: string;
  endDate: string;
};

export type ActivityListState = ActivityListFilters & {
  activities: Activity[];
  total: number;
  scrollY: number;
  loadedAt: number;
};

let state: ActivityListState | null = null;

export const getActivityListState = () => state;

export const setActivityListState = (next: ActivityListState) => {
  state = next;
};

export const rememberActivityListScroll = (scrollY: number) => {
  if (state) state = { ...state, scrollY };
};

export const clearActivityListState = () => {
  state = null;
};
