/**
 * MemberCalendar Component
 * User-facing calendar page with day/month view selection
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarGrid } from "@/admin/gym-calendar/components/CalendarGrid";
import { DayView } from "@/admin/gym-calendar/components/DayView";
import {
  getSchedulesByDateRange,
  ClassSchedule,
} from "@/admin/gym-calendar/api/schedules";
import {
  getEventsByDateRange,
  GymEvent,
} from "@/admin/gym-calendar/api/events";
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { Calendar, CalendarDays, CheckCircle2, UserCheck, Dumbbell } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserCalendarSelections,
  toggleCalendarSelection,
  UserCalendarSelection
} from "@/admin/gym-calendar/api/userSelections";
import { cn } from "@/lib/utils";

export default function MemberCalendar() {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [events, setEvents] = useState<GymEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [calendarMode, setCalendarMode] = useState<"gym" | "personal">("gym");
  const [userSelections, setUserSelections] = useState<UserCalendarSelection[]>([]);
  const [pendingSelection, setPendingSelection] = useState<{ id: string, type: 'schedule' | 'event', title: string } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user } = useAuth();

  // Fetch user selections on mount
  useEffect(() => {
    if (user) {
      fetchSelections();
    }
  }, [user]);

  // Fetch schedules and events for the current month or day
  useEffect(() => {
    if (viewMode === "month") {
      fetchDataForMonth();
    } else {
      fetchDataForDay();
    }
  }, [currentMonth, currentDate, viewMode]);

  const fetchSelections = async () => {
    if (!user) return;
    try {
      const selections = await getUserCalendarSelections(user.id);
      setUserSelections(selections);
    } catch (error) {
      console.error("Error fetching selections:", error);
    }
  };

  const fetchDataForMonth = async () => {
    try {
      setIsLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const [schedulesData, eventsData] = await Promise.all([
        getSchedulesByDateRange(
          format(monthStart, "yyyy-MM-dd"),
          format(monthEnd, "yyyy-MM-dd")
        ),
        getEventsByDateRange(
          format(monthStart, "yyyy-MM-dd"),
          format(monthEnd, "yyyy-MM-dd")
        ),
      ]);
      // Only show published schedules to members
      setSchedules(schedulesData.filter(s => s.is_published));
      setEvents(eventsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load calendar data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDataForDay = async () => {
    try {
      setIsLoading(true);
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);
      const [schedulesData, eventsData] = await Promise.all([
        getSchedulesByDateRange(
          format(dayStart, "yyyy-MM-dd"),
          format(dayEnd, "yyyy-MM-dd")
        ),
        getEventsByDateRange(
          format(dayStart, "yyyy-MM-dd"),
          format(dayEnd, "yyyy-MM-dd")
        ),
      ]);
      // Only show published schedules to members
      setSchedules(schedulesData.filter(s => s.is_published));
      setEvents(eventsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load calendar data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelection = async (targetId: string, type: 'schedule' | 'event') => {
    try {
      if (!isSelected(targetId)) {
        setPendingSelection({ id: targetId, type, title: "" }); // Title will be handled per click
        setIsDialogOpen(true);
        return;
      }
      await performToggle(targetId, type);
    } catch (error) {
      toast.error("Failed to update schedule");
    }
  };

  const performToggle = async (targetId: string, type: 'schedule' | 'event') => {
    if (!user) return;
    const added = await toggleCalendarSelection(user.id, targetId, type, userSelections);
    toast.success(added ? "Added to your schedule" : "Removed from your schedule");
    fetchSelections();
  };

  const isSelected = (targetId: string) => {
    return userSelections.some(s => s.schedule_id === targetId || s.event_id === targetId);
  };

  const handleScheduleClick = (schedule: ClassSchedule) => {
    const title = schedule.gym_classes?.name || "this class";
    setPendingSelection({ id: schedule.id, type: 'schedule', title });
    setIsDialogOpen(true);
  };

  const handleEventClick = (event: GymEvent) => {
    const title = event.title || "this event";
    setPendingSelection({ id: event.id, type: 'event', title });
    setIsDialogOpen(true);
  };

  const handleDateClick = (date: Date) => {
    // Switch to day view when clicking a date
    setCurrentDate(date);
    setViewMode("day");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">
            {calendarMode === "gym" ? "Gym Calendar" : "My Schedule"}
          </h1>
          <Tabs value={calendarMode} onValueChange={(value) => setCalendarMode(value as "gym" | "personal")} className="hidden sm:block">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="gym" className="gap-2">
                <Dumbbell className="h-4 w-4" />
                Gym Calendar
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2">
                <UserCheck className="h-4 w-4" />
                My Schedule
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "month" | "day")}>
          <TabsList>
            <TabsTrigger value="month">
              <Calendar className="h-4 w-4 mr-2" />
              Month
            </TabsTrigger>
            <TabsTrigger value="day">
              <CalendarDays className="h-4 w-4 mr-2" />
              Day
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="sm:hidden">
        <Tabs value={calendarMode} onValueChange={(value) => setCalendarMode(value as "gym" | "personal")}>
          <TabsList className="w-full">
            <TabsTrigger value="gym" className="flex-1">Gym</TabsTrigger>
            <TabsTrigger value="personal" className="flex-1">My Schedule</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar View */}
      {viewMode === "month" ? (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Calendar</CardTitle>
            <CardDescription>
              Navigate through months to see all scheduled classes and events. Click on a date to view the day schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <CalendarGrid
                schedules={calendarMode === "personal"
                  ? schedules.filter(s => isSelected(s.id))
                  : schedules
                }
                events={calendarMode === "personal"
                  ? events.filter(e => isSelected(e.id))
                  : events
                }
                onScheduleClick={handleScheduleClick}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                allowDateClick={true}
                selectedIds={userSelections.map(s => s.schedule_id || s.event_id || "")}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Schedule</CardTitle>
                <CardDescription>
                  View all classes and events for the selected day.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const prevDay = new Date(currentDate);
                    prevDay.setDate(prevDay.getDate() - 1);
                    setCurrentDate(prevDay);
                  }}
                >
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextDay = new Date(currentDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setCurrentDate(nextDay);
                  }}
                >
                  Next →
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <DayView
                date={currentDate}
                schedules={calendarMode === "personal"
                  ? schedules.filter(s => isSelected(s.id))
                  : schedules
                }
                events={calendarMode === "personal"
                  ? events.filter(e => isSelected(e.id))
                  : events
                }
                onScheduleClick={handleScheduleClick}
                onEventClick={handleEventClick}
                allowDateClick={false}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {pendingSelection && isSelected(pendingSelection.id) ? "Drop from Schedule" : "Add to Schedule"}
            </DialogTitle>
            <DialogDescription>
              {pendingSelection && isSelected(pendingSelection.id)
                ? `Remove "${pendingSelection?.title}" from your Personal Calendar?`
                : `Add "${pendingSelection?.title}" to your Personal Calendar?`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {pendingSelection && isSelected(pendingSelection.id) ? "Cancel" : "No"}
            </Button>
            <Button
              variant={pendingSelection && isSelected(pendingSelection.id) ? "destructive" : "default"}
              onClick={() => {
                if (pendingSelection) {
                  performToggle(pendingSelection.id, pendingSelection.type);
                  setIsDialogOpen(false);
                }
              }}
            >
              {pendingSelection && isSelected(pendingSelection.id) ? "Drop" : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

