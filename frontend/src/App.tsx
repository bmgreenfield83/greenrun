import { lazy, Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";

import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";

// The dashboard is the landing page and ships with the app; every other page (and the heavy calendar and
// chart libraries behind them) loads on first visit.
const ActivityDetailPage = lazy(() =>
  import("./pages/ActivityDetailPage").then((m) => ({
    default: m.ActivityDetailPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage })),
);
const PlansPage = lazy(() =>
  import("./pages/PlansPage").then((m) => ({ default: m.PlansPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ExportsPage = lazy(() =>
  import("./pages/ExportsPage").then((m) => ({ default: m.ExportsPage })),
);

export default function App() {
  return (
    <AppShell>
      {/* While a page loads, the scene shows through rather than a spinner. */}
      <Suspense fallback={null}>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/plans" component={PlansPage} />
          <Route path="/activities/:id">
            {(params) => <ActivityDetailPage activityId={params.id} />}
          </Route>
          {/* The activity list and import page now live in the calendar's day view. */}
          <Route path="/activities">
            <Redirect to="/calendar" replace />
          </Route>
          <Route path="/import">
            <Redirect to="/calendar" replace />
          </Route>
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/exports" component={ExportsPage} />
          <Route path="/settings" component={SettingsPage} />
        </Switch>
      </Suspense>
    </AppShell>
  );
}
