import { SectionHeader } from "./SectionHeader";
import { Card } from "@/components/ui/card";

const schedule = [
  {
    day: "Monday",
    items: [
      "Aerobics – 05:15–06:00",
      "Bootcamp – 06:30–07:30",
      "Spinning – 18:00–19:00",
      "Yoga – 19:00–20:00",
    ],
  },
  {
    day: "Tuesday",
    items: [
      "Aerobics – 05:15–06:00",
      "Battle Ropes – 06:30–07:30",
      "Bootcamp – 18:00–19:00",
    ],
  },
  {
    day: "Wednesday",
    items: [
      "Aerobics – 05:15–06:00",
      "Bootcamp – 06:30–07:30",
      "Spinning – 18:00–19:00",
      "Boxing – 19:00–20:00",
    ],
  },
  {
    day: "Thursday",
    items: [
      "Aerobics – 05:15–06:00",
      "Step Aerobics – 06:30–07:30",
      "Bootcamp – 18:00–19:00",
      "Yoga – 18:00–19:00",
    ],
  },
  {
    day: "Friday",
    items: [
      "Aerobics – 05:15–06:00",
      "Step Aerobics – 06:30–07:30",
      "Spinning – 18:00–19:00",
      "Boxing – 18:00–19:00",
    ],
  },
  {
    day: "Saturday",
    items: ["Aerobics – 06:15–07:15", "Yoga – 07:15–08:15"],
  },
  {
    day: "Sunday",
    items: ["No class schedule found"],
  },
];

export function ClassScheduleSection() {
  return (
    <section id="classes" className="space-y-10">
      <SectionHeader
        eyebrow="Classes"
        title="Our class timetable"
        description="Cardio, strength and mind‑body sessions to keep training fun and consistent."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {schedule.map((day) => (
          <Card
            key={day.day}
            className="p-4 border-border/60 flex flex-col gap-2"
          >
            <p className="text-sm font-semibold">{day.day}</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {day.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}



