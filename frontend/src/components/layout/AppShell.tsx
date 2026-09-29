import DirectionsRunRounded from "@mui/icons-material/DirectionsRunRounded";
import {
  alpha,
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
} from "@mui/material";
import type { PropsWithChildren } from "react";
import { Link, useLocation } from "wouter";

import { bottomBarHeight, colors, pixelFont } from "../../app/tokens";
import { BottomTabBar } from "./BottomTabBar";
import { MoreMenu } from "./MoreMenu";
import {
  isActivePath,
  primaryNavigation,
  secondaryNavigation,
  type NavigationItem,
} from "./navigation";
import { SceneBackground } from "./SceneBackground";

const headerButtonSx = (active: boolean) => ({
  flexShrink: 0,
  minHeight: 36,
  px: 1.25,
  borderRadius: "4px",
  fontSize: "0.9rem",
  border: "2px solid transparent",
  "&.Mui-focusVisible, &:focus-visible": {
    outline: `3px solid ${colors.orange}`,
    outlineOffset: 1,
  },
  ...(active
    ? {
        bgcolor: colors.cream,
        color: colors.forest,
        borderColor: colors.forestDark,
        boxShadow: `2px 2px 0 ${colors.shadow}`,
        "&:hover": { bgcolor: colors.cream },
      }
    : {
        color: alpha(colors.cream, 0.86),
        "&:hover": { color: colors.cream, bgcolor: alpha(colors.cream, 0.12) },
      }),
});

function HeaderLink({
  item,
  location,
  showIcon,
}: {
  item: NavigationItem;
  location: string;
  showIcon: boolean;
}) {
  const active = isActivePath(location, item.path);
  const Icon = item.icon;
  return (
    <Button
      component={Link}
      href={item.path}
      color="inherit"
      startIcon={showIcon ? <Icon fontSize="small" /> : undefined}
      aria-current={active ? "page" : undefined}
      sx={headerButtonSx(active)}
    >
      {item.label}
    </Button>
  );
}

function Wordmark() {
  return (
    <Box
      component={Link}
      href="/"
      aria-label="Go to dashboard"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.25,
        color: colors.cream,
        textDecoration: "none",
        borderRadius: "4px",
        "&:focus-visible": {
          outline: `3px solid ${colors.orange}`,
          outlineOffset: 3,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          display: "grid",
          placeItems: "center",
          width: 32,
          height: 32,
          borderRadius: "4px",
          bgcolor: colors.orange,
          color: colors.ink,
          border: `2px solid ${colors.forestDark}`,
          boxShadow: `2px 2px 0 ${colors.shadow}`,
        }}
      >
        <DirectionsRunRounded fontSize="small" />
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: pixelFont,
          fontSize: { xs: "1.1rem", sm: "1.25rem" },
          letterSpacing: "0.02em",
          lineHeight: 1,
          textShadow: `2px 2px 0 ${colors.shadow}`,
        }}
      >
        Greenrun
      </Box>
    </Box>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const [location] = useLocation();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <SceneBackground path={location} />
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: "absolute",
          left: 16,
          top: -64,
          zIndex: (theme) => theme.zIndex.appBar + 1,
          px: 2,
          py: 1,
          borderRadius: "4px",
          border: `2px solid ${colors.border}`,
          bgcolor: "background.paper",
          color: "primary.dark",
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: `3px 3px 0 ${colors.shadow}`,
          "&:focus": { top: 10 },
        }}
      >
        Skip to content
      </Box>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: alpha(colors.forest, 0.88),
          backdropFilter: "blur(10px) saturate(1.2)",
          borderBottom: `2px solid ${colors.forestDark}`,
          color: colors.cream,
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Toolbar
            disableGutters
            sx={{ gap: 2, minHeight: { xs: 52, sm: 56 } }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Wordmark />
            </Box>
            {/* Desktop: every destination inline. */}
            <Stack
              direction="row"
              spacing={0.5}
              component="nav"
              aria-label="Primary navigation"
              sx={{ display: { xs: "none", lg: "flex" } }}
            >
              {[...primaryNavigation, ...secondaryNavigation].map((item) => (
                <HeaderLink
                  key={item.path}
                  item={item}
                  location={location}
                  showIcon={false}
                />
              ))}
            </Stack>
            {/* Tablet: main five plus a More menu. */}
            <Stack
              direction="row"
              spacing={0.5}
              component="nav"
              aria-label="Section navigation"
              sx={{ display: { xs: "none", sm: "flex", lg: "none" } }}
            >
              {primaryNavigation.map((item) => (
                <HeaderLink
                  key={item.path}
                  item={item}
                  location={location}
                  showIcon={false}
                />
              ))}
              <MoreMenu
                location={location}
                placement="below"
                renderTrigger={({ triggerProps, icon, active }) => (
                  <Button
                    {...triggerProps}
                    color="inherit"
                    endIcon={icon}
                    sx={headerButtonSx(active)}
                  >
                    More
                  </Button>
                )}
              />
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>
      <Container
        maxWidth="lg"
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          pt: { xs: 2.5, md: 4 },
          pb: {
            xs: `calc(${bottomBarHeight + 28}px + env(safe-area-inset-bottom))`,
            sm: 6,
          },
          px: { xs: 2, sm: 3 },
          "&:focus": { outline: "none" },
        }}
      >
        {children}
      </Container>
      <BottomTabBar location={location} />
    </Box>
  );
}
