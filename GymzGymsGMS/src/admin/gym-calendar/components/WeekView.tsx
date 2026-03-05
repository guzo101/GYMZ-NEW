/**
 * WeekView Component
 * Weekly calendar view showing scheduled classes and events for a week
 */

import { format, isSameDay, startOfWeek, endOfWeek, addDays, eachDayOfInterval, startOfDay, addHours } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { ClassSchedule } from "../api/schedules";
import { GymEvent } from "../api/events";
import { Badge } from "@/components/ui/badge";

interface WeekViewProps {
  weekStart: Date;
  schedules: ClassSchedule[];
  events: GymEvent[];
  onScheduleClick: (schedule: ClassSchedule) => void;
  onEventClick: (event: GymEvent) => void;
  onDateClick?: (date: Date) => void;
  allowDateClick?: boolean;
}

export function WeekView({
  weekStart,
  schedules,
  events,
  onScheduleClick,
  onEventClick,
  onDateClick,
  allowDateClick = false,
}: WeekViewProps) {
  const weekStartDate = startOfWeek(weekStart, { weekStartsOn: 1 }); // Monday
  const weekEndDate = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate });
  const hours = Array.from({ length: 24 }, (_, i) => addHours(startOfDay(weekStartDate), i));

  const getSchedulesForDate = (date: Date): ClassSchedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter((schedule) => schedule.date === dateStr);
  };

  const getEventsForDate = (date: Date): GymEvent[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter((event) => format(new Date(event.eventDate), "yyyy-MM-dd") === dateStr);
  };

  const getTimeSlotItems = (date: Date, hour: Date) => {
    const hourStr = format(hour, "HH:mm");
    const nextHourStr = format(addHours(hour, 1), "HH:mm");
    const dateStr = format(date, "yyyy-MM-dd");

    const scheduleItems = schedules.filter((schedule) => {
      if (schedule.date !== dateStr) return false;
      const scheduleStart = schedule.start_time;
      const scheduleEnd = schedule.end_time;
      return scheduleStart < nextHourStr && scheduleEnd > hourStr;
    });

    const eventItems = events.filter((event) => {
      if (format(new Date(event.eventDate), "yyyy-MM-dd") !== dateStr) return false;
      if (!event.startTime || !event.endTime) return false;
      const eventStart = event.startTime;
      const eventEnd = event.endTime;
      return eventStart < nextHourStr && eventEnd > hourStr;
    });

    return { scheduleItems, eventItems };
  };

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Week Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {format(weekStartDate, "MMMM d")} - {format(weekEndDate, "d, yyyy")}
          </h2>
        </div>
      </div>

      {/* Week Schedule */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Day Headers */}
              <div className="grid grid-cols-8 border-b sticky top-0 bg-background z-10">
                <div className="p-2 border-r font-medium text-sm text-muted-foreground">
                  Time
                </div>
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 border-r text-center ${isToday ? "bg-accent" : ""}`}
                    >
                      <div className="text-xs text-muted-foreground uppercase">
                        {format(day, "EEE")}
                      </div>
                      <div className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
                        {format(day, "d")}
                      </div>
                      {isToday && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Today
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Time Slots */}
              <div className="divide-y">
                {hours.map((hour) => (
                  <div
                    key={hour.toISOString()}
                    className="grid grid-cols-8 border-b min-h-[60px]"
                  >
                    {/* Time Label */}
                    <div className="p-2 border-r flex items-start justify-end bg-muted/20">
                      <span className="text-xs font-medium text-muted-foreground">
                        {format(hour, "HH:mm")}
                      </span>
                    </div>

                    {/* Day Columns */}
                    {weekDays.map((day) => {
                      const { scheduleItems, eventItems } = getTimeSlotItems(day, hour);
                      const hasItems = scheduleItems.length > 0 || eventItems.length > 0;
                      const isToday = isSameDay(day, today);

                      return (
                        <div
                          key={`${day.toISOString()}-${hour.toISOString()}`}
                          className={`p-1 border-r space-y-1 ${isToday ? "bg-accent/10" : ""} hover:bg-muted/30 transition-colors`}
                          onClick={() => {
                            if (allowDateClick && onDateClick) {
                              onDateClick(day);
                            }
                          }}
                        >
                          {hasItems ? (
                            <>
                              {scheduleItems.map((schedule) => (
                                <div
                                  key={`schedule-${schedule.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onScheduleClick(schedule);
                                  }}
                                  className="text-xs p-1.5 bg-primary/10 hover:bg-primary/20 rounded cursor-pointer transition-colors border-l-2 border-primary"
                                  title={`${schedule.gym_classes?.name || "Class"} - ${schedule.start_time} to ${schedule.end_time}`}
                                >
                                  <div className="font-medium truncate">
                                    {schedule.gym_classes?.name || "Unknown Class"}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {schedule.start_time}
                                  </div>
                                </div>
                              ))}
                              {eventItems.map((event) => (
                                <div
                                  key={`event-${event.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEventClick(event);
                                  }}
                                  className="text-xs p-1.5 rounded cursor-pointer transition-colors border-l-2"
                                  style={{
                                    backgroundColor: `${event.color}15`,
                                    borderLeftColor: event.color,
                                  }}
                                  title={`${event.title}${event.startTime ? ` - ${event.startTime} to ${event.endTime}` : ''}`}
                                >
                                  <div className="font-medium truncate" style={{ color: event.color }}>
                                    {event.title}
                                  </div>
                                  {event.startTime && (
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {event.startTime}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        <strong>{schedules.length}</strong> class{schedules.length !== 1 ? "es" : ""} scheduled
        {events.length > 0 && (
          <>
            {" • "}
            <strong>{events.length}</strong> event{events.length !== 1 ? "s" : ""}
          </>
        )}
      </div>
    </div>
  );
}






