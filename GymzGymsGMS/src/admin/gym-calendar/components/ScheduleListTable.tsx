/**
 * ScheduleListTable Component
 * Displays all scheduled classes in a table with edit/delete actions
 */

import { ClassSchedule } from "../api/schedules";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Calendar, CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ScheduleListTableProps {
  schedules: ClassSchedule[];
  onEdit: (schedule: ClassSchedule) => void;
  onDelete: (id: string) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  isLoading?: boolean;
}

export function ScheduleListTable({
  schedules,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  isLoading = false,
}: ScheduleListTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No schedules found. Create your first schedule to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Class Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Slots</TableHead>
            <TableHead>Trainer</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => (
            <TableRow key={schedule.id}>
              <TableCell>
                {schedule.is_published ? (
                  <Badge variant="default" className="bg-green-600">
                    On Calendar
                  </Badge>
                ) : (
                  <Badge variant="secondary">Draft</Badge>
                )}
              </TableCell>
              <TableCell className="font-medium">
                {schedule.gym_classes?.name || "Unknown Class"}
              </TableCell>
              <TableCell>
                {format(new Date(schedule.date), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>
                {schedule.start_time} - {schedule.end_time}
              </TableCell>
              <TableCell>{schedule.room || "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    schedule.slots_available > 10
                      ? "default"
                      : schedule.slots_available > 0
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {schedule.slots_available} available
                </Badge>
              </TableCell>
              <TableCell>
                {schedule.gym_classes?.trainer_name || "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {schedule.is_published ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnpublish?.(schedule.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                    >
                      <CalendarX className="h-4 w-4 mr-1" />
                      Drop Class
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPublish?.(schedule.id)}
                      className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Add to Calendar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(schedule)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(schedule.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

