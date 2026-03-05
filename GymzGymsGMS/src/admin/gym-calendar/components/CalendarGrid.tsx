/**
 * CalendarGrid Component
 * Monthly calendar view with scheduled classes displayed in date cells
 */

import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassSchedule } from "../api/schedules";
import { GymEvent } from "../api/events";
import { Badge } from "@/components/ui/badge";

interface CalendarGridProps {
  schedules: ClassSchedule[];
  events: GymEvent[];
  onScheduleClick: (schedule: ClassSchedule) => void;
  onEventClick: (event: GymEvent) => void;
  onDateClick?: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  allowDateClick?: boolean;
  selectedIds?: string[];
}

export function CalendarGrid({
  schedules,
  events,
  onScheduleClick,
  onEventClick,
  onDateClick,
  currentMonth,
  onMonthChange,
  allowDateClick = false,
  selectedIds = [],
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getSchedulesForDate = (date: Date): ClassSchedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter((schedule) => schedule.date === dateStr);
  };

  const getEventsForDate = (date: Date): GymEvent[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter((event) => event.event_date === dateStr);
  };

  const goToPreviousMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    onMonthChange(new Date());
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {/* Week day headers */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-sm text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day) => {
              const daySchedules = getSchedulesForDate(day);
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              const allItems = [
                ...daySchedules.map(s => ({ type: 'schedule' as const, data: s })),
                ...dayEvents.map(e => ({ type: 'event' as const, data: e }))
              ];

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[120px] border rounded-lg p-2 ${isCurrentMonth ? "bg-background" : "bg-muted/30"
                    } ${isTodayDate ? "ring-2 ring-primary" : ""} ${allowDateClick && isCurrentMonth ? "cursor-pointer hover:bg-muted/50" : ""
                    }`}
                  onClick={() => {
                    if (allowDateClick && isCurrentMonth && onDateClick) {
                      onDateClick(day);
                    }
                  }}
                >
                  <div
                    className={`text-sm font-medium mb-1 ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                      } ${isTodayDate ? "text-primary font-bold" : ""}`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {allItems.slice(0, 3).map((item) => {
                      if (item.type === 'schedule') {
                        const schedule = item.data;
                        const isSelected = selectedIds.includes(schedule.id);
                        return (
                          <div
                            key={`schedule-${schedule.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onScheduleClick(schedule);
                            }}
                            className={cn(
                              "text-xs p-1 rounded cursor-pointer transition-colors flex items-center justify-between",
                              isSelected ? "bg-primary/30" : "bg-primary/10 hover:bg-primary/20"
                            )}
                            title={`${schedule.gym_classes?.name || "Class"} - ${schedule.start_time} to ${schedule.end_time}`}
                          >
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="font-medium truncate">
                                {schedule.gym_classes?.name || "Unknown"}
                              </div>
                              <div className="text-muted-foreground text-[10px]">
                                {schedule.start_time}
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                          </div>
                        );
                      } else {
                        const event = item.data;
                        const isSelected = selectedIds.includes(event.id);
                        return (
                          <div
                            key={`event-${event.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                            className={cn(
                              "text-xs p-1 rounded cursor-pointer transition-colors border-l-2 flex items-center justify-between",
                              isSelected ? "opacity-100 ring-1 ring-inset ring-foreground/20" : "opacity-80"
                            )}
                            style={{
                              backgroundColor: isSelected ? `${event.color}30` : `${event.color}15`,
                              borderLeftColor: event.color,
                            }}
                            title={`${event.title}${event.start_time ? ` - ${event.start_time} to ${event.end_time}` : ''}`}
                          >
                            <div className="flex-1 min-w-0 pr-1 text-[10px]">
                              <div className="font-medium truncate" style={{ color: event.color }}>
                                {event.title}
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: event.color }} />}
                          </div>
                        );
                      }
                    })}
                    {allItems.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{allItems.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary rounded"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-muted/30 rounded"></div>
          <span>Other month</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary/10 rounded border-l-2 border-primary"></div>
          <span>Class Schedule</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-l-2" style={{ backgroundColor: '#3b82f615', borderLeftColor: '#3b82f6' }}></div>
          <span>Event</span>
        </div>
        {allowDateClick && (
          <div className="flex items-center gap-2 text-primary">
            <span>💡 Click on a date to add an event</span>
          </div>
        )}
      </div>
    </div>
  );
}

