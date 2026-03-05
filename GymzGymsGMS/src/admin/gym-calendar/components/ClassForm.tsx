/**
 * ClassForm Component
 * Modal form for creating and editing gym classes
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GymClass, CreateClassData, UpdateClassData } from "../api/classes";
import { getAllTrainers, Trainer } from "../api/trainers";
import { format, addMonths } from "date-fns";

interface ClassFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateClassData | UpdateClassData, scheduleOptions?: {
    scheduleType: "none" | "single" | "recurring";
    date?: string;
    startTime?: string;
    endTime?: string;
    room?: string;
    slotsAvailable?: number;
    recurringEndDate?: string;
  }) => Promise<void>;
  classData?: GymClass | null;
  isSubmitting?: boolean;
}

export function ClassForm({
  open,
  onOpenChange,
  onSubmit,
  classData,
  isSubmitting = false,
}: ClassFormProps) {
  const [formData, setFormData] = useState<CreateClassData>({
    name: "",
    description: "",
    difficulty: "All Levels",
    trainer_name: "",
    duration_minutes: 60,
  });

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scheduleType, setScheduleType] = useState<"none" | "single" | "recurring">("none");
  const [scheduleDate, setScheduleDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("10:00");
  const [room, setRoom] = useState<string>("");
  const [slotsAvailable, setSlotsAvailable] = useState<number>(20);
  const [recurringEndDate, setRecurringEndDate] = useState<string>(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Fetch trainers on open
  useEffect(() => {
    if (open) {
      const fetchTrainers = async () => {
        try {
          const data = await getAllTrainers();
          setTrainers(data);
        } catch (error) {
          console.error("Error fetching trainers:", error);
        }
      };
      fetchTrainers();
    }
  }, [open]);

  // Reset form when dialog opens/closes or classData changes
  useEffect(() => {
    if (open) {
      if (classData) {
        setFormData({
          name: classData.name || "",
          description: classData.description || "",
          difficulty: classData.difficulty || "All Levels",
          trainer_name: classData.trainer_name || "",
          duration_minutes: classData.duration_minutes || 60,
        });
        setScheduleType("none");
      } else {
        setFormData({
          name: "",
          description: "",
          difficulty: "All Levels",
          trainer_name: "",
          duration_minutes: 60,
        });
        // Reset schedule fields for new class
        setScheduleType("none");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setScheduleDate(format(tomorrow, "yyyy-MM-dd"));
        setStartTime("09:00");
        setEndTime("10:00");
        setRoom("");
        setSlotsAvailable(20);
        setRecurringEndDate(format(addMonths(tomorrow, 1), "yyyy-MM-dd"));
        setSelectedDays([1, 2, 3, 4, 5]); // Default to Monday-Friday
      }
      setErrors({});
    }
  }, [open, classData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Class name is required";
    }

    if (!formData.duration_minutes || formData.duration_minutes < 1) {
      newErrors.duration_minutes = "Duration must be at least 1 minute";
    }

    if (formData.duration_minutes > 480) {
      newErrors.duration_minutes = "Duration cannot exceed 8 hours";
    }

    // Validate schedule if scheduling is enabled
    if (scheduleType !== "none" && !classData) {
      if (!scheduleDate) {
        newErrors.scheduleDate = "Schedule date is required";
      } else {
        const scheduleDateObj = new Date(scheduleDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (scheduleDateObj < today) {
          newErrors.scheduleDate = "Cannot schedule classes in the past";
        }
      }

      if (!startTime) {
        newErrors.startTime = "Start time is required";
      }

      if (!endTime) {
        newErrors.endTime = "End time is required";
      }

      if (startTime && endTime && endTime <= startTime) {
        newErrors.endTime = "End time must be after start time";
      }

      if (scheduleType === "recurring") {
        if (!recurringEndDate) {
          newErrors.recurringEndDate = "End date is required for recurring schedules";
        } else {
          const startDate = new Date(scheduleDate);
          const endDate = new Date(recurringEndDate);
          if (endDate < startDate) {
            newErrors.recurringEndDate = "End date must be after start date";
          }
        }
        if (selectedDays.length === 0) {
          newErrors.selectedDays = "Please select at least one day of the week";
        }
      }

      if (slotsAvailable < 1) {
        newErrors.slotsAvailable = "Slots available must be at least 1";
      }
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
      const scheduleOptions = scheduleType !== "none" && !classData ? {
        scheduleType,
        date: scheduleDate,
        startTime,
        endTime,
        room: room || undefined,
        slotsAvailable,
        recurringEndDate: scheduleType === "recurring" ? recurringEndDate : undefined,
        selectedDays: scheduleType === "recurring" ? selectedDays : undefined,
      } : undefined;

      await onSubmit(formData, scheduleOptions);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {classData ? "Edit Class" : "Create New Class"}
          </DialogTitle>
          <DialogDescription>
            {classData
              ? "Update the class information below."
              : "Fill in the details to create a new gym class."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Class Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Morning Yoga, HIIT Bootcamp"
              required
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe the class, what to expect, etc."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select
                value={formData.difficulty || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, difficulty: value })
                }
              >
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                  <SelectItem value="All Levels">All Levels</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_minutes">
                Duration (minutes) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="duration_minutes"
                type="number"
                min="1"
                max="480"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration_minutes: parseInt(e.target.value) || 60,
                  })
                }
                required
              />
              {errors.duration_minutes && (
                <p className="text-sm text-destructive">
                  {errors.duration_minutes}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trainer_name">Trainer</Label>
            <Select
              value={formData.trainer_name || ""}
              onValueChange={(value) =>
                setFormData({ ...formData, trainer_name: value })
              }
            >
              <SelectTrigger id="trainer_name">
                <SelectValue placeholder="Select a trainer" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="none">No Trainer</SelectItem>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.name}>
                    <div className="flex flex-col">
                      <span className="font-medium">{trainer.name}</span>
                      {trainer.role && (
                        <span className="text-xs text-muted-foreground">
                          {trainer.role} {trainer.department ? `- ${trainer.department}` : ""}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Select from available staff members. Go to Staff section to manage profiles.
            </p>
          </div>

          {/* Schedule Section - Only show when creating new class */}
          {!classData && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Schedule on Calendar</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={scheduleType === "none" ? "default" : "outline"}
                    onClick={() => setScheduleType("none")}
                    className="flex-1"
                  >
                    Don't Schedule
                  </Button>
                  <Button
                    type="button"
                    variant={scheduleType === "single" ? "default" : "outline"}
                    onClick={() => setScheduleType("single")}
                    className="flex-1"
                  >
                    Single Instance
                  </Button>
                  <Button
                    type="button"
                    variant={scheduleType === "recurring" ? "default" : "outline"}
                    onClick={() => setScheduleType("recurring")}
                    className="flex-1"
                  >
                    Recurring (Multi-Day)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {scheduleType === "none" && "This will only create the class definition without adding it to the calendar."}
                  {scheduleType === "single" && "Creates one session on the specified date."}
                  {scheduleType === "recurring" && "Creates multiple sessions over a range of dates for selected weekdays."}
                </p>
              </div>

              {scheduleType !== "none" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduleDate">
                        {scheduleType === "recurring" ? "Start Date" : "Date"} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="scheduleDate"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={format(new Date(), "yyyy-MM-dd")}
                        required
                      />
                      {errors.scheduleDate && (
                        <p className="text-sm text-destructive">{errors.scheduleDate}</p>
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
                          min={scheduleDate}
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
                      <Label htmlFor="startTime">
                        Start Time <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                      />
                      {errors.startTime && (
                        <p className="text-sm text-destructive">{errors.startTime}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endTime">
                        End Time <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                      />
                      {errors.endTime && (
                        <p className="text-sm text-destructive">{errors.endTime}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="room">Room</Label>
                      <Input
                        id="room"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="e.g., Studio A, Main Gym"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slotsAvailable">
                        Slots Available <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="slotsAvailable"
                        type="number"
                        min="1"
                        value={slotsAvailable}
                        onChange={(e) => setSlotsAvailable(parseInt(e.target.value) || 20)}
                        required
                      />
                      {errors.slotsAvailable && (
                        <p className="text-sm text-destructive">{errors.slotsAvailable}</p>
                      )}
                    </div>
                  </div>

                  {scheduleType === "recurring" && (
                    <div className="space-y-2">
                      <Label>
                        Select Days of the Week <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid grid-cols-7 gap-2">
                        {[
                          { value: 0, label: "Sun" },
                          { value: 1, label: "Mon" },
                          { value: 2, label: "Tue" },
                          { value: 3, label: "Wed" },
                          { value: 4, label: "Thu" },
                          { value: 5, label: "Fri" },
                          { value: 6, label: "Sat" },
                        ].map((day) => (
                          <Button
                            key={day.value}
                            type="button"
                            variant={selectedDays.includes(day.value) ? "default" : "outline"}
                            onClick={() => {
                              if (selectedDays.includes(day.value)) {
                                setSelectedDays(selectedDays.filter(d => d !== day.value));
                              } else {
                                setSelectedDays([...selectedDays, day.value]);
                              }
                            }}
                            className="w-full"
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                      {errors.selectedDays && (
                        <p className="text-sm text-destructive">{errors.selectedDays}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : classData
                  ? "Update Class"
                  : "Create Class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

