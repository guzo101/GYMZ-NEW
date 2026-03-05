/**
 * ClassesPage Component
 * Admin page for managing gym classes (CRUD operations)
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ClassForm } from "../components/ClassForm";
import { ClassListTable } from "../components/ClassListTable";
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
  getAllClasses,
  createClass,
  updateClass,
  deleteClass,
  GymClass,
  CreateClassData,
  UpdateClassData,
} from "../api/classes";
import { createSchedule, CreateScheduleData } from "../api/schedules";
import { format, addDays, getDay } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function ClassesPage() {
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<GymClass | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all classes on component mount
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setIsLoading(true);
      const data = await getAllClasses();
      setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast.error("Failed to load classes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingClass(null);
    setIsFormOpen(true);
  };

  const handleEdit = (classData: GymClass) => {
    setEditingClass(classData);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingClassId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingClassId) return;

    try {
      await deleteClass(deletingClassId);
      toast.success("Class deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeletingClassId(null);
      fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Failed to delete class");
    }
  };

  const handleSubmit = async (
    data: CreateClassData | UpdateClassData,
    scheduleOptions?: {
      scheduleType: "none" | "single" | "recurring";
      date?: string;
      startTime?: string;
      endTime?: string;
      room?: string;
      slotsAvailable?: number;
      recurringEndDate?: string;
      selectedDays?: number[]; // Days of week: 0=Sunday, 1=Monday, ..., 6=Saturday
    }
  ) => {
    try {
      setIsSubmitting(true);
      if (editingClass) {
        await updateClass(editingClass.id, data as UpdateClassData);
        toast.success("Class updated successfully");
      } else {
        // Create the class first
        const newClass = await createClass(data as CreateClassData);
        toast.success("Class created successfully");

        // If schedule options provided, create schedules
        if (scheduleOptions && scheduleOptions.scheduleType !== "none") {
          if (scheduleOptions.scheduleType === "single") {
            // Create single schedule
            const scheduleData: CreateScheduleData = {
              class_id: newClass.id,
              date: scheduleOptions.date!,
              start_time: scheduleOptions.startTime!,
              end_time: scheduleOptions.endTime!,
              room: scheduleOptions.room,
              slots_available: scheduleOptions.slotsAvailable || 20,
            };
            await createSchedule(scheduleData);
            toast.success("Class scheduled successfully");
            // Send notifications
            await sendScheduleNotifications([scheduleData], newClass.name);
          } else if (scheduleOptions.scheduleType === "recurring") {
            // Create recurring schedules for selected days only
            const startDate = new Date(scheduleOptions.date!);
            const endDate = new Date(scheduleOptions.recurringEndDate!);
            const schedules: CreateScheduleData[] = [];
            const daysToSchedule = scheduleOptions.selectedDays || [1, 2, 3, 4, 5]; // Default to weekdays

            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              const dayOfWeek = getDay(currentDate); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
              // Only create schedule if this day is in the selected days
              if (daysToSchedule.includes(dayOfWeek)) {
                schedules.push({
                  class_id: newClass.id,
                  date: format(currentDate, "yyyy-MM-dd"),
                  start_time: scheduleOptions.startTime!,
                  end_time: scheduleOptions.endTime!,
                  room: scheduleOptions.room,
                  slots_available: scheduleOptions.slotsAvailable || 20,
                });
              }
              currentDate = addDays(currentDate, 1);
            }

            // Create all schedules
            for (const schedule of schedules) {
              await createSchedule(schedule);
            }

            // Send notifications
            await sendScheduleNotifications(schedules, newClass.name);
            toast.success(`Class scheduled for ${schedules.length} days`);
          }
        }
      }
      setIsFormOpen(false);
      setEditingClass(null);
      fetchClasses();
    } catch (error) {
      console.error("Error saving class:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save class"
      );
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendScheduleNotifications = async (schedules: CreateScheduleData[], className: string) => {
    try {
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
          message: `New class scheduled: ${className} on ${format(new Date(schedule.date), "MMM d, yyyy")} at ${schedule.start_time}`,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Class Manager</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage gym classes
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Class
        </Button>
      </div>

      {/* Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Classes</CardTitle>
          <CardDescription>
            View and manage all gym classes. Deleting a class will also delete all its schedules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassListTable
            classes={classes}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Form */}
      <ClassForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        classData={editingClass}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the class
              and all associated schedules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingClassId(null)}>
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

