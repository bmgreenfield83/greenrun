import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import DirectionsRunRounded from "@mui/icons-material/DirectionsRunRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import EventNoteRounded from "@mui/icons-material/EventNoteRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";

export type NavigationItem = {
  label: string;
  path: string;
  icon: typeof DirectionsRunRounded;
};

/** The everyday destinations: phone tab bar and tablet header. Activities are found and imported
 * from the calendar's day view. */
export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", path: "/", icon: DirectionsRunRounded },
  { label: "Calendar", path: "/calendar", icon: CalendarMonthRounded },
  { label: "Analytics", path: "/analytics", icon: InsightsRounded },
  { label: "Plans", path: "/plans", icon: EventNoteRounded },
];

/** Less frequent destinations, behind "More" on phones and tablets. */
export const secondaryNavigation: NavigationItem[] = [
  { label: "Exports", path: "/exports", icon: DownloadRounded },
  { label: "Settings", path: "/settings", icon: SettingsRounded },
];

export const isActivePath = (location: string, path: string) =>
  path === "/"
    ? location === "/"
    : location === path || location.startsWith(`${path}/`);
