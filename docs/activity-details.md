# Activity details

Phase 5 adds an activity index and complete activity-detail view. The canonical backend remains capable of representing manual activities, but the user-approved Phase 8 refinement removes manual creation from the interface because this installation uses imported activity files.

The detail view presents objective summary values, editable subjective fields, weather notes, the linked planned session, stored derived metrics, and the exact embedded Garmin laps. It does not infer interval roles from lap data.

The activity index uses server-backed 25-item pages with a **Load more** control, sport filtering, and inclusive start/end-date filters, so older activities remain accessible as the database grows.

Objective rate and cadence labels are sport-aware. Runs, walks, and hikes use pace per mile and step cadence; bike activities use speed in miles per hour and cadence in rpm; strength activities omit pace/speed fields. Lap tables and sample charts follow the same rules and suppress charts whose source values are entirely absent.

`GET /api/activities/{activity_id}/samples` flattens the activity's ten-minute sample chunks in elapsed-time order for display. The frontend uses those normalized samples for synchronized heart-rate, pace, cadence, and elevation charts plus a pace-versus-heart-rate scatterplot. Raw sample-table rows remain hidden.

Run activity pages also include a same-weekday trend. It contains the current run and up to 12 earlier runs on the same local weekday, ordered chronologically. All running categories—including track workouts—are eligible, and neither category nor distance is used as a filter. Average pace and average heart rate are the default Y axes; either axis can show pace, heart rate, or distance, while the secondary axis can be disabled. Pace is inverted so faster values appear higher, distance is drawn as bars, every tooltip retains all three values, and selecting a point opens that activity.

The workload-adjusted heart-rate response card has a narrowly scoped per-activity override for unreliable early sensor readings. Entering a mile marker excludes earlier samples from this analysis only, persists the corresponding canonical meter value, and recalculates the activity. Raw FIT samples, charts, summaries, and exports remain intact.

Imported objective FIT values remain protected from metadata edits. Subjective notes can still be edited after import.
