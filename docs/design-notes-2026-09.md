# Design notes (September 2026)

Owner decisions and critiques recorded 2026-09-29, for the next design work. Not yet implemented.

## UI: second pass wanted (deferred)

- The first UI polish pass (2026-09-29) was judged too minimal: most pages look largely unchanged.
- The current look is **not** something to strictly adhere to. The whole app can get a facelift.
- Deferred by the owner for now; do it after the analytics revision, and design it together with the
  pixel-art backgrounds below so the two fit each other.
- Heart-rate zone colors: currently all shades of blue, which makes them hard to read. Use the familiar
  scale the owner is used to: Z1 blue, Z2 green, Z3 yellow, Z4 orange, Z5 red, everywhere zones appear
  (zone table, weekly time-in-zone bars, easy-run distribution).
- Suggested order (owner agreed to start with a proposal): 1) short design proposal (facelift direction,
  palette/layout concept, scene sketches) for approval; 2) facelift; 3) pixel-art scenes, each phase verified
  with screenshots.

## Pixel-art backgrounds

- Occupy the page background, the way Greenhome's control room does (not only a banner).
- Two scenes:
  - **Trail** for most pages: a paved trail through the woods at Quiet Waters Park, Annapolis. The
    **South River Overlook** is the owner's favorite and the park's most notable spot (the owner runs to it and
    turns around; it is not central to the route, but it should be recognizable).
  - **Lab** for the Analytics page: builds on the Greenhome Greenrun station (runner on a treadmill wired to an
    HR monitor, a coach/scientist taking notes).
- The runner should look like the owner: usually wears a hat, no sunglasses. Reference photos are in
  `imageref/` (git- and Docker-ignored; private; never commit or publish them).
- Still open: how strongly the scenes react to data (plan, weekly progress, last run, season/time of day), and
  keeping charts and tables readable over a busy background.
