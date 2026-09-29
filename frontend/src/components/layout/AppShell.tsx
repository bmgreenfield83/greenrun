import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import DirectionsRunRounded from "@mui/icons-material/DirectionsRunRounded";
import ListAltRounded from "@mui/icons-material/ListAltRounded";
import FileUploadRounded from "@mui/icons-material/FileUploadRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import EventNoteRounded from "@mui/icons-material/EventNoteRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState, type PropsWithChildren } from "react";
import { Link, useLocation } from "wouter";

const navigation = [
  { label: "Dashboard", path: "/", icon: <DirectionsRunRounded /> },
  { label: "Calendar", path: "/calendar", icon: <CalendarMonthRounded /> },
  { label: "Plans", path: "/plans", icon: <EventNoteRounded /> },
  { label: "Activities", path: "/activities", icon: <ListAltRounded /> },
  { label: "Import", path: "/import", icon: <FileUploadRounded /> },
  { label: "Analytics", path: "/analytics", icon: <InsightsRounded /> },
  { label: "Exports", path: "/exports", icon: <DownloadRounded /> },
  { label: "Settings", path: "/settings", icon: <SettingsRounded /> },
];

const isActivePath = (location: string, path: string) =>
  path === "/"
    ? location === "/"
    : location === path || location.startsWith(`${path}/`);

const headerFocusRing = {
  "&.Mui-focusVisible, &:focus-visible": {
    outline: "2px solid #fff",
    outlineOffset: 2,
    boxShadow: "none",
  },
};

export function AppShell({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh" }}>
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
          borderRadius: 2,
          bgcolor: "background.paper",
          color: "primary.dark",
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: 3,
          "&:focus": { top: 12 },
        }}
      >
        Skip to content
      </Box>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "rgba(255,255,255,.12)" }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 60, sm: 68 } }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ flexGrow: 1, minWidth: 0 }}
          >
            <Box
              component={Link}
              href="/"
              aria-label="Go to dashboard"
              sx={{
                display: "grid",
                placeItems: "center",
                width: 36,
                height: 36,
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,.13)",
                color: "inherit",
                textDecoration: "none",
                transition: "background-color 150ms ease",
                "&:hover": { bgcolor: "rgba(255,255,255,.22)" },
                "&:focus-visible": {
                  outline: "2px solid #fff",
                  outlineOffset: 2,
                },
              }}
            >
              <DirectionsRunRounded />
            </Box>
            <Typography variant="h6" noWrap>
              Greenrun
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            component="nav"
            aria-label="Primary navigation"
            sx={{
              display: { xs: "none", lg: "flex" },
              overflowX: "auto",
              py: 0.5,
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {navigation.map(({ label, path, icon }) => {
              const active = isActivePath(location, path);
              return (
                <Button
                  key={path}
                  component={Link}
                  href={path}
                  color="inherit"
                  startIcon={icon}
                  aria-current={active ? "page" : undefined}
                  sx={{
                    flexShrink: 0,
                    ...headerFocusRing,
                    ...(active
                      ? {
                          bgcolor: "rgba(255,255,255,.16)",
                          boxShadow: "inset 0 -2px 0 rgba(255,255,255,.75)",
                        }
                      : {
                          color: "rgba(255,255,255,.82)",
                          "&:hover": {
                            color: "#fff",
                            bgcolor: "rgba(255,255,255,.08)",
                          },
                        }),
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
          <IconButton
            color="inherit"
            aria-label="Open navigation"
            aria-controls={
              mobileNavigationOpen ? "mobile-navigation" : undefined
            }
            aria-expanded={mobileNavigationOpen}
            onClick={() => setMobileNavigationOpen(true)}
            sx={{
              display: { xs: "inline-flex", lg: "none" },
              flexShrink: 0,
              width: 44,
              height: 44,
              ...headerFocusRing,
            }}
          >
            <MenuRounded />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="right"
        open={mobileNavigationOpen}
        onClose={() => setMobileNavigationOpen(false)}
        ModalProps={{ keepMounted: true }}
      >
        <Box id="mobile-navigation" sx={{ width: "min(84vw, 320px)" }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ minHeight: 68, px: 2 }}
          >
            <Typography variant="h6">Navigation</Typography>
            <IconButton
              aria-label="Close navigation"
              onClick={() => setMobileNavigationOpen(false)}
            >
              <CloseRounded />
            </IconButton>
          </Stack>
          <Divider />
          <List component="nav" aria-label="Mobile navigation" sx={{ p: 1.5 }}>
            {navigation.map(({ label, path, icon }) => {
              const active = isActivePath(location, path);
              return (
                <ListItemButton
                  key={path}
                  component={Link}
                  href={path}
                  selected={active}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileNavigationOpen(false)}
                  sx={{ borderRadius: 2, mb: 0.5, minHeight: 48 }}
                >
                  <ListItemIcon sx={{ minWidth: 42, color: "inherit" }}>
                    {icon}
                  </ListItemIcon>
                  <ListItemText primary={label} />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>
      <Container
        maxWidth="xl"
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          py: { xs: 3, md: 5 },
          px: { xs: 2, sm: 3 },
          "&:focus": { outline: "none" },
        }}
      >
        {children}
      </Container>
    </Box>
  );
}
