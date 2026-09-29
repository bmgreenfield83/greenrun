import { alpha, Box, ButtonBase, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "wouter";

import { bottomBarHeight, colors } from "../../app/tokens";
import { MoreMenu } from "./MoreMenu";
import { isActivePath, primaryNavigation } from "./navigation";

const tabSx = (active: boolean) => ({
  position: "relative" as const,
  flex: "1 1 0",
  minWidth: 0,
  height: bottomBarHeight,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
  color: active ? colors.cream : alpha(colors.cream, 0.78),
  textDecoration: "none",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: "22%",
    right: "22%",
    height: 4,
    bgcolor: active ? colors.orange : "transparent",
  },
  "& .tab-icon": {
    display: "grid",
    placeItems: "center",
    width: 40,
    height: 28,
    borderRadius: "4px",
    bgcolor: active ? alpha(colors.cream, 0.16) : "transparent",
  },
  "&.Mui-focusVisible, &:focus-visible": {
    outline: `3px solid ${colors.orange}`,
    outlineOffset: -4,
  },
});

function TabLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{
        fontSize: "0.66rem",
        fontWeight: 700,
        lineHeight: 1.1,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Typography>
  );
}

/** Fixed bottom tab bar for phones: the five main destinations plus "More". */
export function BottomTabBar({ location }: { location: string }) {
  return (
    <Box
      component="nav"
      aria-label="Mobile navigation"
      sx={{
        display: { xs: "flex", sm: "none" },
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        pb: "env(safe-area-inset-bottom)",
        bgcolor: alpha(colors.forest, 0.94),
        backdropFilter: "blur(10px)",
        borderTop: `2px solid ${colors.forestDark}`,
        boxShadow: `0 -3px 0 ${alpha(colors.shadow, 0.25)}`,
      }}
    >
      {primaryNavigation.map(({ label, path, icon: Icon }) => {
        const active = isActivePath(location, path);
        return (
          <ButtonBase
            key={path}
            component={Link}
            href={path}
            aria-current={active ? "page" : undefined}
            sx={tabSx(active)}
          >
            <span className="tab-icon">
              <Icon fontSize="small" />
            </span>
            <TabLabel>{label}</TabLabel>
          </ButtonBase>
        );
      })}
      <MoreMenu
        location={location}
        placement="above"
        renderTrigger={({ triggerProps, icon, active }) => (
          <ButtonBase {...triggerProps} sx={tabSx(active)}>
            <span className="tab-icon">{icon}</span>
            <TabLabel>More</TabLabel>
          </ButtonBase>
        )}
      />
    </Box>
  );
}
