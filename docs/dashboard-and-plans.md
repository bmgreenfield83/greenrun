# Dashboard and plan management

The dashboard shows three compact tiles from `GET /api/analytics/summary`: **This week** (the current partial week's miles and its planned miles), **4-wk avg** (the trailing 4-week average of the most recent completed week), and **Plan** (plan-to-date completed miles against miles due so far). With an active plan, a card shows the plan week number, this week's completed vs planned miles, and sessions completed of those due so far. It also lists upcoming unfulfilled sessions, the five most recent activities, and the four newest qualifying workload-adjusted heart-rate response results. The summary returns that history oldest first, so the dashboard sorts it newest first, and it marks results that need recalculation. Each workout, activity, and response row links to its calendar date or activity detail page.

The Plans page shows the import controls first, then the active plan. Its read-only schedule groups planned sessions into Monday-based plan weeks and shows status, planned distance, week focus, and declared weekly mileage. Archived, completed, and abandoned plans remain available below the active plan.

Every plan shows its structured goal (`goal_target`, time at a distance) next to the free-text goals, with **Set goal** / **Edit goal**. The editor offers 1 mile, 5K, 10K, half marathon, and marathon presets or a custom distance in mi, km, or m. It accepts a target time as m:ss or h:mm:ss (decimal seconds allowed) and previews the goal pace. **Clear goal** sends `goal_target: null`. Changes are saved with `PATCH /api/plans/{id}`. The active plan's goal drives the Analytics goal card and the track rep chart.

Every plan can be exported as its original plan template or as a plan analysis export. The active plan may be archived after explicit confirmation. Archiving retains its planned sessions and all activity links; destructive plan deletion is intentionally not exposed because it could break historical relationships.

Only sessions from the active plan appear as planned entries on the calendar. Archived-plan sessions remain available through plan history and exports, while completed activities previously linked to them continue to appear once as recorded activities.

Timezone management remains deferred: the stored application setting must first be wired through FIT normalization so the interface cannot imply that a saved value affects imports when it does not.
