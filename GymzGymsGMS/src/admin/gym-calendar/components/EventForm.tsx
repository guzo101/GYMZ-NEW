/**
 * EventForm Component
 * Modal form for creating and editing calendar events
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
import { GymEvent, CreateEventData, UpdateEventData } from "../api/events";
import { format } from "date-fns";

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateEventData | UpdateEventData) => Promise<void>;
  eventData?: GymEvent | null;
  defaultDate?: Date;
  isSubmitting?: boolean;
  onDelete?: (id: string) => void;
}

export function EventForm({
  open,
  onOpenChange,
  onSubmit,
  eventData,
  defaultDate,
  isSubmitting = false,
  onDelete,
}: EventFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventDate: defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    location: "",
    eventType: "",
    color: "#3b82f6",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes or eventData changes
  useEffect(() => {
    if (open) {
      if (eventData) {
        setFormData({
          title: eventData.title || "",
          description: eventData.description || "",
          eventDate: format(new Date(eventData.eventDate), "yyyy-MM-dd"),
          startTime: eventData.startTime || "",
          endTime: eventData.endTime || "",
          location: eventData.location || "",
          eventType: eventData.eventType || "",
          color: eventData.color || "#3b82f6",
        });
      } else {
        const dateToUse = defaultDate || new Date();
        setFormData({
          title: "",
          description: "",
          eventDate: format(dateToUse, "yyyy-MM-dd"),
          startTime: "",
          endTime: "",
          location: "",
          eventType: "",
          color: "#3b82f6",
        });
      }
      setErrors({});
    }
  }, [open, eventData, defaultDate]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Event title is required";
    }

    if (!formData.eventDate) {
      newErrors.eventDate = "Date is required";
    } else {
      const eDate = new Date(formData.eventDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (eDate < today) {
        newErrors.eventDate = "Cannot create events in the past";
      }
    }

    // If one time is provided, both should be provided
    if ((formData.startTime && !formData.endTime) || (!formData.startTime && formData.endTime)) {
      newErrors.startTime = "Both start and end times must be provided together";
    }

    if (formData.startTime && formData.endTime) {
      if (formData.endTime <= formData.startTime) {
        newErrors.endTime = "End time must be after start time";
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
      // Create ISO timestamps
      const eventDateISO = formData.startTime
        ? `${formData.eventDate}T${formData.startTime}:00Z`
        : `${formData.eventDate}T00:00:00Z`;

      const endDateISO = formData.endTime
        ? `${formData.eventDate}T${formData.endTime}:00Z`
        : undefined;

      const submitData: any = {
        title: formData.title,
        description: formData.description,
        eventDate: eventDateISO,
        endDate: endDateISO,
        location: formData.location,
        eventType: formData.eventType,
        color: formData.color,
      };

      await onSubmit(submitData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      if (error instanceof Error) {
        setErrors({ submit: error.message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {eventData ? "Edit Event" : "Create New Event"}
          </DialogTitle>
          <DialogDescription>
            {eventData
              ? "Update the event information below."
              : "Add a new event to the calendar (holidays, maintenance, special events, etc.)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Event Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., New Year's Day, Gym Maintenance, Workshop"
              required
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
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
              placeholder="Describe the event..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="eventDate"
                type="date"
                value={formData.eventDate}
                onChange={(e) =>
                  setFormData({ ...formData, eventDate: e.target.value })
                }
                min={format(new Date(), "yyyy-MM-dd")}
                required
              />
              {errors.eventDate && (
                <p className="text-sm text-destructive">{errors.eventDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Select
                value={formData.eventType || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, eventType: value })
                }
              >
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Holiday">Holiday</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Special Event">Special Event</SelectItem>
                  <SelectItem value="Workshop">Workshop</SelectItem>
                  <SelectItem value="Closure">Closure</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time (Optional)</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
              />
              {errors.startTime && (
                <p className="text-sm text-destructive">{errors.startTime}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time (Optional)</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
              />
              {errors.endTime && (
                <p className="text-sm text-destructive">{errors.endTime}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="e.g., Main Gym, Studio A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="w-16 h-10"
                />
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {eventData && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onDelete(eventData.id);
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
                : eventData
                  ? "Update Event"
                  : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

