/**
 * DayView Component
 * Daily calendar view with hourly time slots showing scheduled classes and events
 */

import { format, isSameDay, startOfDay, addHours, setHours } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { ClassSchedule } from "../api/schedules";
import { GymEvent } from "../api/events";
import { Badge } from "@/components/ui/badge";

interface DayViewProps {
  date: Date;
  schedules: ClassSchedule[];
  events: GymEvent[];
  onScheduleClick: (schedule: ClassSchedule) => void;
  onEventClick: (event: GymEvent) => void;
  onDateClick?: (date: Date) => void;
  allowDateClick?: boolean;
}

export function DayView({
  date,
  schedules,
  events,
  onScheduleClick,
  onEventClick,
  onDateClick,
  allowDateClick = false,
}: DayViewProps) {
  const dayStart = startOfDay(date);
  const hours = Array.from({ length: 24 }, (_, i) => addHours(dayStart, i));
  const dateStr = format(date, "yyyy-MM-dd");

  const getSchedulesForDate = (): ClassSchedule[] => {
    return schedules.filter((schedule) => schedule.date === dateStr);
  };

  const getEventsForDate = (): GymEvent[] => {
    return events.filter((event) => format(new Date(event.eventDate), "yyyy-MM-dd") === dateStr);
  };

  const daySchedules = getSchedulesForDate();
  const dayEvents = getEventsForDate();

  const getTimeSlotItems = (hour: Date) => {
    const hourStr = format(hour, "HH:mm");
    const nextHourStr = format(addHours(hour, 1), "HH:mm");

    const scheduleItems = daySchedules.filter((schedule) => {
      const scheduleStart = schedule.start_time;
      const scheduleEnd = schedule.end_time;
      // Check if schedule overlaps with this hour
      return scheduleStart < nextHourStr && scheduleEnd > hourStr;
    });

    const eventItems = dayEvents.filter((event) => {
      if (!event.startTime || !event.endTime) return false;
      const eventStart = event.startTime;
      const eventEnd = event.endTime;
      // Check if event overlaps with this hour
      return eventStart < nextHourStr && eventEnd > hourStr;
    });

    return { scheduleItems, eventItems };
  };

  const isToday = isSameDay(date, new Date());

  return (
    <div className="space-y-4">
      {/* Day Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {format(date, "EEEE, MMMM d, yyyy")}
          </h2>
          {isToday && (
            <Badge variant="outline" className="mt-2">
              Today
            </Badge>
          )}
        </div>
      </div>

      {/* Day Schedule */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {hours.map((hour) => {
              const { scheduleItems, eventItems } = getTimeSlotItems(hour);
              const hasItems = scheduleItems.length > 0 || eventItems.length > 0;

              return (
                <div
                  key={hour.toISOString()}
                  className="grid grid-cols-12 gap-2 p-2 hover:bg-muted/30 transition-colors min-h-[80px]"
                >
                  {/* Time Label */}
                  <div className="col-span-1 flex items-start justify-end pt-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(hour, "HH:mm")}
                    </span>
                  </div>

                  {/* Time Slot Content */}
                  <div className="col-span-11 space-y-1">
                    {hasItems ? (
                      <>
                        {scheduleItems.map((schedule) => (
                          <div
                            key={`schedule-${schedule.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onScheduleClick(schedule);
                            }}
                            className="text-sm p-2 bg-primary/10 hover:bg-primary/20 rounded cursor-pointer transition-colors border-l-2 border-primary"
                            title={`${schedule.gym_classes?.name || "Class"} - ${schedule.start_time} to ${schedule.end_time}`}
                          >
                            <div className="font-medium">
                              {schedule.gym_classes?.name || "Unknown Class"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {schedule.start_time} - {schedule.end_time}
                              {schedule.room && ` • ${schedule.room}`}
                              {schedule.gym_classes?.trainer_name && ` • ${schedule.gym_classes.trainer_name}`}
                            </div>
                            {schedule.slots_available !== undefined && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {schedule.slots_available} slots available
                              </div>
                            )}
                          </div>
                        ))}
                        {eventItems.map((event) => (
                          <div
                            key={`event-${event.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                            className="text-sm p-2 rounded cursor-pointer transition-colors border-l-2"
                            style={{
                              backgroundColor: `${event.color}15`,
                              borderLeftColor: event.color,
                            }}
                            title={`${event.title}${event.startTime ? ` - ${event.startTime} to ${event.endTime}` : ''}`}
                          >
                            <div className="font-medium" style={{ color: event.color }}>
                              {event.title}
                            </div>
                            {event.startTime && event.endTime && (
                              <div className="text-xs text-muted-foreground">
                                {event.startTime} - {event.endTime}
                              </div>
                            )}
                            {event.location && (
                              <div className="text-xs text-muted-foreground">
                                📍 {event.location}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground/50 py-2">
                        No scheduled items
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {(daySchedules.length > 0 || dayEvents.length > 0) && (
        <div className="text-sm text-muted-foreground">
          <strong>{daySchedules.length}</strong> class{daySchedules.length !== 1 ? "es" : ""} scheduled
          {dayEvents.length > 0 && (
            <>
              {" • "}
              <strong>{dayEvents.length}</strong> event{dayEvents.length !== 1 ? "s" : ""}
            </>
          )}
        </div>
      )}
    </div>
  );
}

