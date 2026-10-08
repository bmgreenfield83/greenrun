import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { CalendarEvent } from "../../api/calendar";
import { DayDetailDrawer } from "./DayDetailDrawer";

const session: CalendarEvent = {
  id: "planned-session-1",
  kind: "planned_session",
  title: "Easy run",
  date: "2026-08-06",
  sport: "run",
  status: "planned",
  distance_meters: 8046.72,
  completed_distance_meters: null,
  completed_duration_seconds: null,
  completed_average_speed_mps: null,
  completed_pace_seconds_per_mile: null,
  completed_activity_title: null,
  completed_activity_notes: null,
  planned_session_id: "session-1",
  activity_id: null,
  completed_on_date: null,
  original_scheduled_date: null,
  notes: null,
  instructions: "Warm up, then run five controlled intervals.",
  justification: "Develop speed while supporting the primary goal.",
  skip_reason: null,
  reschedule_notes: null,
};

const activity: CalendarEvent = {
  id: "activity-1",
  kind: "activity",
  title: "Morning run",
  date: "2026-08-06",
  sport: "run",
  status: "unplanned",
  distance_meters: 7900,
  completed_distance_meters: null,
  completed_duration_seconds: null,
  completed_average_speed_mps: null,
  completed_pace_seconds_per_mile: null,
  completed_activity_title: null,
  completed_activity_notes: null,
  planned_session_id: null,
  activity_id: "activity-1",
  completed_on_date: null,
  original_scheduled_date: null,
  notes: null,
  instructions: null,
  skip_reason: null,
  reschedule_notes: null,
};

it("renders calendar status and confirms before skipping", () => {
  const onClose = vi.fn();
  const onSkip = vi.fn();
  render(
    <DayDetailDrawer
      date="2026-08-06"
      events={[session]}
      allActivities={[]}
      error={null}
      busy={false}
      onClose={onClose}
      onSkip={onSkip}
      onUnskip={vi.fn()}
      onAttach={vi.fn()}
      onDetach={vi.fn()}
      importing={false}
      importNotice={null}
      onImportActivity={vi.fn()}
      onUploadFiles={vi.fn()}
      onViewActivity={vi.fn()}
    />,
  );

  expect(screen.getByText("planned")).toBeInTheDocument();
  const instructions = screen.getByText(
    "Warm up, then run five controlled intervals.",
  );
  expect(instructions).toBeInTheDocument();
  expect(instructions.closest(".MuiCard-root")).toBeNull();
  expect(
    screen.getByText("Develop speed while supporting the primary goal."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close day details" }));
  expect(onClose).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("checkbox", { name: "Mark skipped" }));

  expect(onSkip).not.toHaveBeenCalled();
  expect(screen.getByText("Mark this session skipped?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm skip" }));
  expect(onSkip).toHaveBeenCalledWith("session-1");
});

it("automatically enables attachment for one unplanned activity on the same date", () => {
  const onAttach = vi.fn();
  render(
    <DayDetailDrawer
      date="2026-08-06"
      events={[session, activity]}
      allActivities={[activity]}
      error={null}
      busy={false}
      onClose={vi.fn()}
      onSkip={vi.fn()}
      onUnskip={vi.fn()}
      onAttach={onAttach}
      onDetach={vi.fn()}
      importing={false}
      importNotice={null}
      onImportActivity={vi.fn()}
      onUploadFiles={vi.fn()}
      onViewActivity={vi.fn()}
    />,
  );

  const attach = screen.getByRole("button", { name: "Attach Morning run" });
  expect(attach).toBeEnabled();
  fireEvent.click(attach);
  expect(onAttach).toHaveBeenCalledWith("session-1", "activity-1");
});

it("allows a skipped session to be restored", () => {
  const onUnskip = vi.fn();
  render(
    <DayDetailDrawer
      date="2026-08-06"
      events={[{ ...session, status: "skipped" }]}
      allActivities={[]}
      error={null}
      busy={false}
      onClose={vi.fn()}
      onSkip={vi.fn()}
      onUnskip={onUnskip}
      onAttach={vi.fn()}
      onDetach={vi.fn()}
      importing={false}
      importNotice={null}
      onImportActivity={vi.fn()}
      onUploadFiles={vi.fn()}
      onViewActivity={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("checkbox", { name: "Mark skipped" }));
  expect(onUnskip).toHaveBeenCalledWith("session-1");
});

it("separates the planned workout from the attached run metrics", () => {
  render(
    <DayDetailDrawer
      date="2026-08-06"
      events={[
        {
          ...session,
          status: "completed",
          activity_id: "activity-1",
          completed_on_date: "2026-08-06",
          completed_activity_title: "Run on Aug 06, 2026",
          completed_distance_meters: 8046.72,
          completed_duration_seconds: 2700,
          completed_pace_seconds_per_mile: 540,
        },
      ]}
      allActivities={[]}
      error={null}
      busy={false}
      onClose={vi.fn()}
      onSkip={vi.fn()}
      onUnskip={vi.fn()}
      onAttach={vi.fn()}
      onDetach={vi.fn()}
      importing={false}
      importNotice={null}
      onImportActivity={vi.fn()}
      onUploadFiles={vi.fn()}
      onViewActivity={vi.fn()}
    />,
  );

  expect(screen.getByText("Planned workout")).toBeInTheDocument();
  expect(screen.getByText("What you did")).toBeInTheDocument();
  expect(screen.getByText("Distance")).toBeInTheDocument();
  expect(screen.getByText("5.00 mi")).toBeInTheDocument();
  expect(screen.getByText("Time")).toBeInTheDocument();
  expect(screen.getByText("45:00")).toBeInTheDocument();
  expect(screen.getByText("Average pace")).toBeInTheDocument();
  expect(screen.getByText("9:00/mi")).toBeInTheDocument();
  expect(screen.queryByText(/Completed distance/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Completed pace/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Completed on/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Activity: Run on/)).not.toBeInTheDocument();
});

const drawerProps = {
  date: "2026-08-06",
  allActivities: [],
  error: null,
  busy: false,
  importing: false,
  importNotice: null,
  onClose: vi.fn(),
  onSkip: vi.fn(),
  onUnskip: vi.fn(),
  onAttach: vi.fn(),
  onDetach: vi.fn(),
  onImportActivity: vi.fn(),
  onUploadFiles: vi.fn(),
  onViewActivity: vi.fn(),
};

it("imports the day's activity from Garmin or an uploaded FIT file", () => {
  const onImportActivity = vi.fn();
  const onUploadFiles = vi.fn();
  render(
    <DayDetailDrawer
      {...drawerProps}
      events={[]}
      onImportActivity={onImportActivity}
      onUploadFiles={onUploadFiles}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Import activity" }));
  expect(onImportActivity).toHaveBeenCalledOnce();

  const file = new File(["fit"], "run.fit");
  fireEvent.change(screen.getByLabelText("FIT activity files"), {
    target: { files: [file] },
  });
  expect(onUploadFiles).toHaveBeenCalledWith([file]);
});

it("shows import progress and the result", () => {
  render(
    <DayDetailDrawer
      {...drawerProps}
      events={[session]}
      importing
      importNotice={{
        severity: "info",
        text: "No runs on Garmin Connect for this day.",
      }}
    />,
  );

  expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Upload a FIT file" }),
  ).toBeDisabled();
  expect(
    screen.getByText("No runs on Garmin Connect for this day."),
  ).toBeInTheDocument();
});

it("offers to import another activity on a day that already has one", () => {
  render(<DayDetailDrawer {...drawerProps} events={[activity]} />);

  expect(
    screen.getByRole("button", { name: "Import another activity" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Import activity" }),
  ).not.toBeInTheDocument();
});
