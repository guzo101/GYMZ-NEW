/**
 * ScheduleForm Component
 * Form for creating and editing class schedules
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GymClass } from "../api/classes";
import { ClassSchedule, CreateScheduleData, UpdateScheduleData } from "../api/schedules";
import { format } from "date-fns";

interface ScheduleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: CreateScheduleData | UpdateScheduleData,
    options?: { isRecurring: boolean; endDate?: string }
  ) => Promise<void>;
  scheduleData?: ClassSchedule | null;
  classes: GymClass[];
  isSubmitting?: boolean;
  onDelete?: (id: string) => void;
  defaultDate?: Date;
}

export function ScheduleForm({
  open,
  onOpenChange,
  onSubmit,
  scheduleData,
  classes,
  isSubmitting = false,
  onDelete,
  defaultDate,
}: ScheduleFormProps) {
  const [formData, setFormData] = useState<CreateScheduleData>({
    class_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "10:00",
    room: "",
    slots_available: 20,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scheduleType, setScheduleType] = useState<"single" | "recurring">("single");
  const [recurringEndDate, setRecurringEndDate] = useState<string>("");

  const [duration, setDuration] = useState<number>(60);

  // Sync duration with start/end times
  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const start = new Date(`2000-01-01T${formData.start_time}`);
      const end = new Date(`2000-01-01T${formData.end_time}`);
      const diff = (end.getTime() - start.getTime()) / (1000 * 60);
      if (diff > 0) {
        setDuration(diff);
      }
    }
  }, [formData.start_time, formData.end_time]);

  // Handle class selection change
  const handleClassChange = (classId: string) => {
    const selected = classes.find((c) => c.id === classId);
    if (selected) {
      const classDuration = selected.duration_minutes || 60;
      setDuration(classDuration);

      // Calculate end time based on start time and class duration
      if (formData.start_time) {
        const start = new Date(`2000-01-01T${formData.start_time}`);
        const end = new Date(start.getTime() + classDuration * 60 * 1000);
        const endStr = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
        setFormData({ ...formData, class_id: classId, end_time: endStr });
      } else {
        setFormData({ ...formData, class_id: classId });
      }
    } else {
      setFormData({ ...formData, class_id: classId });
    }
  };

  // Handle duration change
  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    if (formData.start_time) {
      const start = new Date(`2000-01-01T${formData.start_time}`);
      const end = new Date(start.getTime() + newDuration * 60 * 1000);
      const endStr = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
      setFormData({ ...formData, end_time: endStr });
    }
  };

  // Reset form when dialog opens/closes or scheduleData changes
  useEffect(() => {
    if (open) {
      if (scheduleData) {
        setFormData({
          class_id: scheduleData.class_id,
          date: scheduleData.date,
          start_time: scheduleData.start_time,
          end_time: scheduleData.end_time,
          room: scheduleData.room || "",
          slots_available: scheduleData.slots_available,
        });
        setScheduleType("single");
        setRecurringEndDate("");
      } else {
        const dateToUse = defaultDate || (() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow;
        })();
        setFormData({
          class_id: "",
          date: format(dateToUse, "yyyy-MM-dd"),
          start_time: "09:00",
          end_time: "10:00",
          room: "",
          slots_available: 20,
        });
        setScheduleType("single");
        const endDate = new Date(dateToUse);
        endDate.setMonth(endDate.getMonth() + 1);
        setRecurringEndDate(format(endDate, "yyyy-MM-dd"));
        setDuration(60);
      }
      setErrors({});
    }
  }, [open, scheduleData, defaultDate]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.class_id) {
      newErrors.class_id = "Please select a class";
    }

    if (!formData.date) {
      newErrors.date = "Date is required";
    } else {
      const scheduleDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (scheduleDate < today) {
        newErrors.date = "Cannot schedule classes in the past";
      }
    }

    if (!formData.start_time) {
      newErrors.start_time = "Start time is required";
    }

    if (!formData.end_time) {
      newErrors.end_time = "End time is required";
    }

    if (formData.start_time && formData.end_time) {
      if (formData.end_time <= formData.start_time) {
        newErrors.end_time = "End time must be after start time";
      }
    }

    if (!formData.slots_available || formData.slots_available < 1) {
      newErrors.slots_available = "Slots available must be at least 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      await onSubmit(formData, {
        isRecurring: scheduleType === "recurring",
        endDate: scheduleType === "recurring" ? recurringEndDate : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      if (error instanceof Error) {
        setErrors({ submit: error.message });
      }
    }
  };

  const selectedClass = classes.find((c) => c.id === formData.class_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {scheduleData ? "Edit Schedule" : "Create New Schedule"}
          </DialogTitle>
          <DialogDescription>
            {scheduleData
              ? "Update the schedule information below."
              : "Schedule a class for a specific date and time."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class_id">
              Class <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.class_id}
              onValueChange={handleClassChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a class..." />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {classes.map((classItem) => (
                  <SelectItem key={classItem.id} value={classItem.id}>
                    {classItem.name}
                    {classItem.trainer_name && (
                      <span className="text-muted-foreground ml-2">
                        ({classItem.trainer_name})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.class_id && (
              <p className="text-sm text-destructive">{errors.class_id}</p>
            )}
            {selectedClass && (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="duration" className="text-xs">Duration (mins)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => handleDurationChange(parseInt(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                {selectedClass.trainer_name && (
                  <div className="flex-1">
                    <p className="text-xs font-medium">Assigned Coach</p>
                    <p className="text-xs text-muted-foreground">{selectedClass.trainer_name}</p>
                  </div>
                )}
                {selectedClass.difficulty && (
                  <div className="flex-1">
                    <p className="text-xs font-medium">Level</p>
                    <p className="text-xs text-muted-foreground">{selectedClass.difficulty}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={scheduleType === "single" ? "default" : "outline"}
                onClick={() => setScheduleType("single")}
                className="flex-1"
              >
                Single Day
              </Button>
              <Button
                type="button"
                variant={scheduleType === "recurring" ? "default" : "outline"}
                onClick={() => setScheduleType("recurring")}
                className="flex-1"
              >
                Recurring Schedule
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">
                {scheduleType === "recurring" ? "Start Date" : "Date"} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                min={format(new Date(), "yyyy-MM-dd")}
                required
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date}</p>
              )}
            </div>

            {scheduleType === "recurring" && (
              <div className="space-y-2">
                <Label htmlFor="recurringEndDate">
                  End Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="recurringEndDate"
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  min={formData.date}
                  required
                />
                {errors.recurringEndDate && (
                  <p className="text-sm text-destructive">{errors.recurringEndDate}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">
                Start Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                required
              />
              {errors.start_time && (
                <p className="text-sm text-destructive">{errors.start_time}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">
                End Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                required
              />
              {errors.end_time && (
                <p className="text-sm text-destructive">{errors.end_time}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="room">Room</Label>
              <Input
                id="room"
                value={formData.room}
                onChange={(e) =>
                  setFormData({ ...formData, room: e.target.value })
                }
                placeholder="e.g., Studio A, Room 101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slots_available">
                Slots Available <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slots_available"
                type="number"
                min="1"
                value={formData.slots_available}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slots_available: parseInt(e.target.value) || 0,
                  })
                }
                required
              />
              {errors.slots_available && (
                <p className="text-sm text-destructive">
                  {errors.slots_available}
                </p>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {scheduleData && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onDelete(scheduleData.id);
                  onOpenChange(false);
                }}
                disabled={isSubmitting}
                className="w-full sm:w-auto order-3 sm:order-1"
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto order-2"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto order-1 sm:order-3">
              {isSubmitting
                ? "Saving..."
                : scheduleData
                  ? "Update Schedule"
                  : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

