import { Route, Switch } from "wouter";

import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { ActivityDetailPage } from "./pages/ActivityDetailPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { FitImportPage } from "./pages/FitImportPage";
import { PlansPage } from "./pages/PlansPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ExportsPage } from "./pages/ExportsPage";

export default function App() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/plans" component={PlansPage} />
        <Route path="/activities/:id">
          {(params) => <ActivityDetailPage activityId={params.id} />}
        </Route>
        <Route path="/activities" component={ActivitiesPage} />
        <Route path="/import" component={FitImportPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/exports" component={ExportsPage} />
        <Route path="/settings" component={SettingsPage} />
      </Switch>
    </AppShell>
  );
}
