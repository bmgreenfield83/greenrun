# Design notes (September 2026)

Owner decisions and critiques recorded 2026-09-29, for the next design work. Not yet implemented.

## UI: second pass wanted (deferred)

- The first UI polish pass (2026-09-29) was judged too minimal: most pages look largely unchanged.
- The current look is **not** something to strictly adhere to. The whole app can get a facelift.
- Deferred by the owner for now; do it after the analytics revision, and design it together with the
  pixel-art backgrounds below so the two fit each other.

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
