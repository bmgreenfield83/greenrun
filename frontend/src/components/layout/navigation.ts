import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import DirectionsRunRounded from "@mui/icons-material/DirectionsRunRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import EventNoteRounded from "@mui/icons-material/EventNoteRounded";
import FileUploadRounded from "@mui/icons-material/FileUploadRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import ListAltRounded from "@mui/icons-material/ListAltRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";

export type NavigationItem = {
  label: string;
  path: string;
  icon: typeof DirectionsRunRounded;
};

/** The five everyday destinations: phone tab bar and tablet header. */
export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", path: "/", icon: DirectionsRunRounded },
  { label: "Calendar", path: "/calendar", icon: CalendarMonthRounded },
  { label: "Activities", path: "/activities", icon: ListAltRounded },
  { label: "Analytics", path: "/analytics", icon: InsightsRounded },
  { label: "Plans", path: "/plans", icon: EventNoteRounded },
];

/** Less frequent destinations, behind "More" on phones and tablets. */
export const secondaryNavigation: NavigationItem[] = [
  { label: "Import", path: "/import", icon: FileUploadRounded },
  { label: "Exports", path: "/exports", icon: DownloadRounded },
  { label: "Settings", path: "/settings", icon: SettingsRounded },
];

export const isActivePath = (location: string, path: string) =>
  path === "/"
    ? location === "/"
    : location === path || location.startsWith(`${path}/`);
