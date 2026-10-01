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

## Facelift implemented (2026-09-29, "trailhead" look)

- Tokens in `frontend/src/app/tokens.ts` (forest green, parchment panels, sunrise orange, ink text) feed the
  MUI theme (`app/theme.ts`), chart tokens (`features/analytics/chartTheme.ts`) and FullCalendar CSS
  (`styles.css`, via `--gr-*` custom properties).
- Fonts (Google Fonts, `index.html`): Silkscreen (pixel) only for the wordmark, big stats (`StatValue`) and
  overline labels; DM Sans for everything else.
- Panels are opaque "trail signage" (2px border, hard offset shadow, 6px radius) with gaps between them;
  page titles are green sign plates (`PageHeader`); headings between panels use `SectionPlate`.
- HR zone colors (Z1 blue, Z2 green, Z3 yellow, Z4 orange, Z5 red) live in `zoneColors` in `chartTheme.ts`.
- Navigation: slim translucent header (all 8 links on desktop; 5 + "More" on tablets); phones get a fixed
  bottom tab bar (Dashboard, Calendar, Activities, Analytics, Plans + More: Import, Exports, Settings).
- Dashboard: Today hero, Monday–Sunday week strip, goal chip, training-load gauge, recent runs, HR response.
- Background slot: `components/layout/SceneBackground.tsx` renders an empty fixed layer (`z-index: -1`) with
  `data-scene` from `sceneForPath` (`lab` for `/analytics`, `trail` elsewhere) for the pixel-art scenes.

## Pixel-art scenes implemented (2026-09-29)

- Code in `frontend/src/scenes/` (pixel toolkit ported from Greenhome); mounted by
  `components/layout/SceneBackground.tsx`, which starts loading scene data only once a canvas is running.
- **Trail** (`trail.ts`): side-view parallax of Quiet Waters Park: sky by real time of day (dawn, day, dusk, night
  with stars, moon, summer fireflies), trees by season, the South River flowing right to left toward the Bay, the
  South River Overlook (stone plaza, a gazebo at each end, two benches) joined to the trail by a paved spur, woods
  with a resident deer and falling leaves in fall, geese, other runners and dog walkers, and a mile-marker post
  with this week's miles against the plan. The owner's gait follows today's plan (easy, long, fast, done = jogging
  as well, rest = stretching at the foot of the Overlook spur). Everything between the bank and the trail is a
  pre-drawn sprite placed by depth, with parallax from the bank's to the trail's; every depth repeats over the
  same stretch of scrolling as the Overlook, which is what keeps the spur and its clearing lined up.
- A "Hide UI" button (bottom right) hides the whole interface so the scene can be seen on its own.
- **Lab** (`lab.ts`, Analytics): the owner on a treadmill under a wall monitor replaying the last run's heart
  rate colored by zone, a whiteboard with week miles vs plan and minutes per zone, a coach reacting to the load
  band, and a room of medals, trophies, race bibs (347 first), a ZONES poster, a QWP map, a window, and a clock.
- The owner sprite (`sprites.ts`): black cap, glasses, a trimmed beard shadow, dark tee and shorts, blue shoes,
  a watch. Reduced-motion users get a still frame; the scenes do nothing when canvases are unavailable.
- Future (owner idea, 2026-09-29): a proper winter look for the trail. Seasons already switch the trees (bare
  branches and duller grass in December–February); snow on the ground and trees, a frozen river edge, and a
  winter-dressed runner would complete it.
