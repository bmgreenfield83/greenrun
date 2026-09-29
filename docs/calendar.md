# Calendar behavior

The calendar starts each week on Monday and combines planned sessions with imported
activities. When an activity is attached to a planned session, the planned calendar
entry remains the visible event and its completed metrics appear in the day details.
Independent activities appear as their own completed events.

The legend uses blue for planned sessions, green for completed activities or sessions,
and red with reduced opacity for skipped sessions. Planned and completed visibility can
be toggled independently. On dense dates, the calendar limits visible entries and uses
a `+N more` control to expose the remainder.

On smaller screens the toolbar stacks its controls and shows fewer events before using
the overflow control. Calendar events and overflow controls remain keyboard focusable,
and event labels expose their date and status to assistive technology.
