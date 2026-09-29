import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "wouter";

import { isActivePath, secondaryNavigation } from "./navigation";

type MoreMenuProps = {
  location: string;
  /** Renders the trigger; spread `triggerProps` onto a button. */
  renderTrigger: (props: {
    triggerProps: {
      id: string;
      "aria-label": string;
      "aria-haspopup": "menu";
      "aria-controls": string | undefined;
      "aria-expanded": boolean;
      onClick: (event: MouseEvent<HTMLElement>) => void;
    };
    icon: ReactNode;
    active: boolean;
  }) => ReactNode;
  placement: "below" | "above";
};

/** "More" menu with the less frequent destinations (Import, Exports, Settings). */
export function MoreMenu({
  location,
  renderTrigger,
  placement,
}: MoreMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const baseId = useId();
  const menuId = `${baseId}-menu`;
  const triggerId = `${baseId}-trigger`;
  const active = secondaryNavigation.some(({ path }) =>
    isActivePath(location, path),
  );
  const close = () => setAnchor(null);

  return (
    <>
      {renderTrigger({
        triggerProps: {
          id: triggerId,
          "aria-label": "More",
          "aria-haspopup": "menu",
          "aria-controls": anchor ? menuId : undefined,
          "aria-expanded": Boolean(anchor),
          onClick: (event) => setAnchor(event.currentTarget),
        },
        icon: <MoreHorizRounded />,
        active,
      })}
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{
          vertical: placement === "above" ? "top" : "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: placement === "above" ? "bottom" : "top",
          horizontal: "right",
        }}
        slotProps={{
          list: { "aria-labelledby": triggerId, dense: false },
          paper: { sx: { mt: placement === "below" ? 1 : -1, minWidth: 200 } },
        }}
      >
        {secondaryNavigation.map(({ label, path, icon: Icon }) => {
          const current = isActivePath(location, path);
          return (
            <MenuItem
              key={path}
              component={Link}
              href={path}
              selected={current}
              aria-current={current ? "page" : undefined}
              onClick={close}
              sx={{ minHeight: 48, fontWeight: 700 }}
            >
              <ListItemIcon sx={{ color: "primary.main" }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={label}
                slotProps={{ primary: { fontWeight: 700 } }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
