/**
 * SchedulePage Component
 * Admin page for managing class schedules (CRUD operations)
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ScheduleForm } from "../components/ScheduleForm";
import { ScheduleListTable } from "../components/ScheduleListTable";
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
import {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  publishSchedule,
  unpublishSchedule,
  ClassSchedule,
  CreateScheduleData,
  UpdateScheduleData,
} from "../api/schedules";
import { getAllClasses, GymClass } from "../api/classes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function SchedulePage() {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [conflictingSchedule, setConflictingSchedule] = useState<ClassSchedule | null>(null);
  const [pendingPublishId, setPendingPublishId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all schedules and classes on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [schedulesData, classesData] = await Promise.all([
        getAllSchedules(),
        getAllClasses(),
      ]);
      setSchedules(schedulesData);
      setClasses(classesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load schedules");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSchedule(null);
    setIsFormOpen(true);
  };

  const handleEdit = (schedule: ClassSchedule) => {
    setEditingSchedule(schedule);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingScheduleId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingScheduleId) return;

    try {
      await deleteSchedule(deletingScheduleId);
      toast.success("Schedule deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeletingScheduleId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting schedule:", error);
      toast.error("Failed to delete schedule");
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const result = await publishSchedule(id);

      if (!result.success && result.conflict) {
        // Show conflict dialog
        setConflictingSchedule(result.conflict);
        setPendingPublishId(id);
        setIsConflictDialogOpen(true);
      } else {
        toast.success("Schedule added to calendar successfully");
        fetchData();
      }
    } catch (error) {
      console.error("Error publishing schedule:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add schedule to calendar"
      );
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await unpublishSchedule(id);
      toast.success("Schedule removed from calendar");
      fetchData();
    } catch (error) {
      console.error("Error unpublishing schedule:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove schedule from calendar"
      );
    }
  };

  const sendScheduleNotifications = async (schedulesData: CreateScheduleData[]) => {
    try {
      // Get class name for notification
      const classData = classes.find(c => c.id === schedulesData[0].class_id);
      if (!classData) return;

      // Get all members
      const { data: members } = await supabase
        .from("users")
        .select("id")
        .eq("role", "member");

      if (!members || members.length === 0) return;

      // Create notifications for all members
      const notifications = members.flatMap(member =>
        schedulesData.map(schedule => ({
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

  const handleSubmit = async (
    data: CreateScheduleData | UpdateScheduleData,
    options?: { isRecurring: boolean; endDate?: string }
  ) => {
    try {
      setIsSubmitting(true);
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, data as UpdateScheduleData);
        toast.success("Schedule updated successfully");
      } else {
        if (options?.isRecurring && options.endDate) {
          // Create recurring schedules
          const startDate = new Date(data.date);
          const endDate = new Date(options.endDate);
          const schedulesList: CreateScheduleData[] = [];

          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            schedulesList.push({
              ...(data as CreateScheduleData),
              date: format(currentDate, "yyyy-MM-dd"),
            });
            currentDate.setDate(currentDate.getDate() + 1);
          }

          // Create all schedules (as drafts by default)
          for (const schedule of schedulesList) {
            await createSchedule(schedule);
          }

          toast.success(`Successfully created ${schedulesList.length} schedules (as drafts)`);
        } else {
          await createSchedule(data as CreateScheduleData);
          toast.success("Schedule created successfully (as draft)");
        }
      }
      setIsFormOpen(false);
      setEditingSchedule(null);
      fetchData();
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save schedule"
      );
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (classes.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Schedule Manager</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage class schedules
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No classes found. Please create a class first before scheduling.
            </p>
            <Button onClick={() => window.location.href = "/admin/gym-calendar?tab=classes"}>
              Go to Class Manager
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedule Manager</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage class schedules
          </p>
        </div>
        <Button onClick={handleCreate} disabled={classes.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Schedules</CardTitle>
          <CardDescription>
            View and manage all scheduled classes. Use "Add to Calendar" to publish a schedule, making it visible to members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleListTable
            schedules={schedules}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Form */}
      <ScheduleForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        scheduleData={editingSchedule}
        classes={classes}
        isSubmitting={isSubmitting}
      />

      {/* Conflict Dialog */}
      <AlertDialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule Conflict Detected</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictingSchedule && (
                <>
                  <p className="mb-2">
                    This schedule conflicts with an existing class on the calendar:
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm">
                    <p className="font-semibold text-yellow-900">
                      {conflictingSchedule.gym_classes?.name || "Unknown Class"}
                    </p>
                    <p className="text-yellow-800">
                      {conflictingSchedule.start_time} - {conflictingSchedule.end_time}
                    </p>
                    <p className="text-yellow-800">
                      Room: {conflictingSchedule.room || "N/A"}
                    </p>
                  </div>
                  <p className="mt-3">
                    Please edit the schedule to use a different time or room before adding it to the calendar.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsConflictDialogOpen(false);
              setConflictingSchedule(null);
              setPendingPublishId(null);
            }}>
              Close
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsConflictDialogOpen(false);
                const schedule = schedules.find(s => s.id === pendingPublishId);
                if (schedule) {
                  handleEdit(schedule);
                }
                setPendingPublishId(null);
                setConflictingSchedule(null);
              }}
            >
              Edit Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingScheduleId(null)}>
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

