# Dashboard and plan management

The dashboard combines rolling running mileage with the active plan's current-week progress, upcoming unfulfilled sessions, the five most recent activities, and recent qualifying workload-adjusted heart-rate response results. Each workout, activity, and response row links to its relevant calendar date or activity detail page.

The Plans page lists the active plan before the import controls. Its read-only schedule groups planned sessions into Monday-based plan weeks and shows status, planned distance, week focus, and declared weekly mileage. Archived, completed, and abandoned plans remain available below the active plan.

Every plan can be exported as its original plan template or as a plan analysis export. The active plan may be archived after explicit confirmation. Archiving retains its planned sessions and all activity links; destructive plan deletion is intentionally not exposed because it could break historical relationships.

Only sessions from the active plan appear as planned entries on the calendar. Archived-plan sessions remain available through plan history and exports, while completed activities previously linked to them continue to appear once as recorded activities.

Timezone management remains deferred: the stored application setting must first be wired through FIT normalization so the interface cannot imply that a saved value affects imports when it does not.
