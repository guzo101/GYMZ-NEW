/**
 * CalendarPage Component
 * Admin page for viewing calendar with scheduled classes
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarGrid } from "../components/CalendarGrid";
import { DayView } from "../components/DayView";
import { WeekView } from "../components/WeekView";
import { ScheduleForm } from "../components/ScheduleForm";
import { EventForm } from "../components/EventForm";
import {
  getAllSchedules,
  getSchedulesByDateRange,
  ClassSchedule,
  CreateScheduleData,
  UpdateScheduleData,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "../api/schedules";
import {
  getEventsByDateRange,
  createEvent,
  updateEvent,
  deleteEvent,
  GymEvent,
  CreateEventData,
  UpdateEventData,
} from "../api/events";
import { getAllClasses, GymClass } from "../api/classes";
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Calendar, CalendarDays, Calendar as CalendarIcon, Dumbbell, CalendarRange } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CalendarPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [events, setEvents] = useState<GymEvent[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedSchedule, setSelectedSchedule] = useState<ClassSchedule | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<GymEvent | null>(null);
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDateForEvent, setSelectedDateForEvent] = useState<Date | null>(null);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  // Fetch schedules and events for the current month, week, or day
  useEffect(() => {
    if (viewMode === "month") {
      fetchDataForMonth();
    } else if (viewMode === "week") {
      fetchDataForWeek();
    } else {
      fetchDataForDay();
    }
    fetchClasses();
  }, [currentMonth, currentWeek, currentDate, viewMode]);

  const fetchDataForMonth = async () => {
    const gymId = user?.gymId || (user as any)?.gym_id;
    if (!gymId) return;

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
          format(monthStart, "yyyy-MM-dd") + "T00:00:00Z",
          format(monthEnd, "yyyy-MM-dd") + "T23:59:59Z",
          gymId
        ),
      ]);
      // Only show published schedules on calendar
      setSchedules(schedulesData.filter(s => s.is_published));
      setEvents(eventsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load calendar data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDataForWeek = async () => {
    const gymId = user?.gymId || (user as any)?.gym_id;
    if (!gymId) return;

    try {
      setIsLoading(true);
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      const [schedulesData, eventsData] = await Promise.all([
        getSchedulesByDateRange(
          format(weekStart, "yyyy-MM-dd"),
          format(weekEnd, "yyyy-MM-dd")
        ),
        getEventsByDateRange(
          format(weekStart, "yyyy-MM-dd") + "T00:00:00Z",
          format(weekEnd, "yyyy-MM-dd") + "T23:59:59Z",
          gymId
        ),
      ]);
      // Only show published schedules on calendar
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
    const gymId = user?.gymId || (user as any)?.gym_id;
    if (!gymId) return;

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
          format(dayStart, "yyyy-MM-dd") + "T00:00:00Z",
          format(dayEnd, "yyyy-MM-dd") + "T23:59:59Z",
          gymId
        ),
      ]);
      // Only show published schedules on calendar
      setSchedules(schedulesData.filter(s => s.is_published));
      setEvents(eventsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load calendar data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const data = await getAllClasses();
      setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const handleScheduleClick = (schedule: ClassSchedule) => {
    setSelectedSchedule(schedule);
    setIsScheduleFormOpen(true);
  };

  const handleEventClick = (event: GymEvent) => {
    setSelectedEvent(event);
    setIsEventFormOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setPendingDate(date);
    setIsTypeSelectorOpen(true);
  };

  const handleCreateEvent = () => {
    setPendingDate(null);
    setIsTypeSelectorOpen(true);
  };

  const handleTypeSelection = (type: "class" | "event") => {
    setIsTypeSelectorOpen(false);
    if (type === "class") {
      // Open schedule form with the selected date
      if (pendingDate) {
        // We'll need to create a new schedule, so we'll open the form with a default date
        setSelectedSchedule(null);
        setIsScheduleFormOpen(true);
        // The ScheduleForm will need to accept a defaultDate prop
      } else {
        setSelectedSchedule(null);
        setIsScheduleFormOpen(true);
      }
    } else {
      // Open event form
      setSelectedDateForEvent(pendingDate);
      setSelectedEvent(null);
      setIsEventFormOpen(true);
    }
    setPendingDate(null);
  };

  const handleDeleteSchedule = (id: string) => {
    setDeletingScheduleId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteEvent = (id: string) => {
    setDeletingEventId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (deletingScheduleId) {
        await deleteSchedule(deletingScheduleId);
        toast.success("Schedule deleted successfully");
        setDeletingScheduleId(null);
        setSelectedSchedule(null);
        setIsScheduleFormOpen(false);
      } else if (deletingEventId) {
        await deleteEvent(deletingEventId);
        toast.success("Event deleted successfully");
        setDeletingEventId(null);
        setSelectedEvent(null);
        setIsEventFormOpen(false);
      }
      setIsDeleteDialogOpen(false);
      if (viewMode === "month") {
        fetchDataForMonth();
      } else if (viewMode === "week") {
        fetchDataForWeek();
      } else {
        fetchDataForDay();
      }
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    }
  };

  const handleScheduleSubmit = async (
    data: CreateScheduleData | UpdateScheduleData,
    options?: { isRecurring: boolean; endDate?: string }
  ) => {
    try {
      setIsSubmitting(true);
      if (selectedSchedule) {
        await updateSchedule(selectedSchedule.id, data as UpdateScheduleData);
        toast.success("Schedule updated successfully");
      } else {
        if (options?.isRecurring && options.endDate) {
          // Create recurring schedules
          const startDate = new Date(data.date);
          const endDate = new Date(options.endDate);
          const schedules: CreateScheduleData[] = [];

          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            schedules.push({
              ...(data as CreateScheduleData),
              date: format(currentDate, "yyyy-MM-dd"),
            });
            currentDate.setDate(currentDate.getDate() + 1);
          }

          // Create all schedules
          for (const schedule of schedules) {
            await createSchedule(schedule);
          }

          // Send notifications for all created schedules
          await sendScheduleNotifications(schedules);

          toast.success(`Successfully scheduled ${schedules.length} classes`);
        } else {
          await createSchedule(data as CreateScheduleData);
          // Send notification for single schedule
          await sendScheduleNotifications([data as CreateScheduleData]);
          toast.success("Class scheduled successfully");
        }
      }
      setIsScheduleFormOpen(false);
      setSelectedSchedule(null);
      if (viewMode === "month") {
        fetchDataForMonth();
      } else if (viewMode === "week") {
        fetchDataForWeek();
      } else {
        fetchDataForDay();
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : selectedSchedule ? "Failed to update schedule" : "Failed to create schedule"
      );
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendScheduleNotifications = async (schedules: CreateScheduleData[]) => {
    try {
      // Get class name for notification
      const classData = classes.find(c => c.id === schedules[0].class_id);
      if (!classData) return;

      // Get all members
      const { data: members } = await supabase
        .from("users")
        .select("id")
        .eq("role", "member");

      if (!members || members.length === 0) return;

      // Create notifications for all members
      const notifications = members.flatMap(member =>
        schedules.map(schedule => ({
          user_id: member.id,
          type: "class_scheduled",
          message: `New class scheduled: ${classData.name} on ${format(new Date(schedule.date), "MMM d, yyyy")} at ${schedule.start_time}`,
          read: false,
        }))
      );

      // Insert notifications in batches
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        await supabase.from("notifications").insert(batch);
      }
    } catch (error) {
      console.error("Error sending notifications:", error);
      // Don't throw - notifications are not critical
    }
  };

  const handleEventSubmit = async (data: CreateEventData | UpdateEventData) => {
    try {
      setIsSubmitting(true);
      if (selectedEvent) {
        await updateEvent(selectedEvent.id, data as UpdateEventData);
        toast.success("Event updated successfully");
      } else {
        await createEvent(data as CreateEventData, user?.id);
        toast.success("Event created successfully");
      }
      setIsEventFormOpen(false);
      setSelectedEvent(null);
      setSelectedDateForEvent(null);
      if (viewMode === "month") {
        fetchDataForMonth();
      } else if (viewMode === "week") {
        fetchDataForWeek();
      } else {
        fetchDataForDay();
      }
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save event"
      );
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar View</h1>
          <p className="text-muted-foreground mt-1">
            View scheduled classes and events. Click a date to add an event, or click an item to edit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "month" | "week" | "day")}>
            <TabsList>
              <TabsTrigger value="month">
                <Calendar className="h-4 w-4 mr-2" />
                Month
              </TabsTrigger>
              <TabsTrigger value="week">
                <CalendarRange className="h-4 w-4 mr-2" />
                Week
              </TabsTrigger>
              <TabsTrigger value="day">
                <CalendarDays className="h-4 w-4 mr-2" />
                Day
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleCreateEvent}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === "month" ? (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Calendar</CardTitle>
            <CardDescription>
              Navigate through months to see all scheduled classes and events. Click on a date to add an event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <CalendarGrid
                schedules={schedules}
                events={events}
                onScheduleClick={handleScheduleClick}
                onEventClick={handleEventClick}
                onDateClick={(date) => {
                  handleDateClick(date);
                  // Switch to day view when clicking a date
                  setCurrentDate(date);
                  setViewMode("day");
                }}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                allowDateClick={true}
              />
            )}
          </CardContent>
        </Card>
      ) : viewMode === "week" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Weekly Calendar</CardTitle>
                <CardDescription>
                  View all classes and events for the selected week. Click on an item to edit.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const prevWeek = new Date(currentWeek);
                    prevWeek.setDate(prevWeek.getDate() - 7);
                    setCurrentWeek(prevWeek);
                  }}
                >
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeek(new Date())}
                >
                  This Week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextWeek = new Date(currentWeek);
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    setCurrentWeek(nextWeek);
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
              <WeekView
                weekStart={currentWeek}
                schedules={schedules}
                events={events}
                onScheduleClick={handleScheduleClick}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                allowDateClick={true}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Calendar</CardTitle>
                <CardDescription>
                  View all classes and events for the selected day. Click on an item to edit.
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
                schedules={schedules}
                events={events}
                onScheduleClick={handleScheduleClick}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                allowDateClick={true}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit/Create Schedule Form */}
      <ScheduleForm
        open={isScheduleFormOpen}
        onOpenChange={(open) => {
          setIsScheduleFormOpen(open);
          if (!open) {
            setSelectedSchedule(null);
          }
        }}
        onSubmit={handleScheduleSubmit}
        scheduleData={selectedSchedule}
        classes={classes}
        isSubmitting={isSubmitting}
        onDelete={selectedSchedule ? handleDeleteSchedule : undefined}
        defaultDate={pendingDate || undefined}
      />

      {/* Type Selector Dialog */}
      <Dialog open={isTypeSelectorOpen} onOpenChange={setIsTypeSelectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What would you like to add?</DialogTitle>
            <DialogDescription>
              Choose whether you want to schedule a class or create an event.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleTypeSelection("class")}
            >
              <Dumbbell className="h-8 w-8" />
              <span className="font-semibold">Schedule Class</span>
              <span className="text-xs text-muted-foreground">Add a class to the calendar</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleTypeSelection("event")}
            >
              <CalendarIcon className="h-8 w-8" />
              <span className="font-semibold">Create Event</span>
              <span className="text-xs text-muted-foreground">Add an event (holiday, maintenance, etc.)</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTypeSelectorOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Event Form */}
      <EventForm
        open={isEventFormOpen}
        onOpenChange={(open) => {
          setIsEventFormOpen(open);
          if (!open) {
            setSelectedEvent(null);
            setSelectedDateForEvent(null);
          }
        }}
        onSubmit={handleEventSubmit}
        eventData={selectedEvent}
        defaultDate={selectedDateForEvent || undefined}
        isSubmitting={isSubmitting}
        onDelete={selectedEvent ? handleDeleteEvent : undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingScheduleId ? "Delete Schedule?" : "Delete Event?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeletingScheduleId(null);
              setDeletingEventId(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
