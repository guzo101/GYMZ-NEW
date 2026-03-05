/**
 * ClassListTable Component
 * Displays all gym classes in a table with edit/delete actions
 */

import { GymClass } from "../api/classes";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClassListTableProps {
  classes: GymClass[];
  onEdit: (classData: GymClass) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function ClassListTable({
  classes,
  onEdit,
  onDelete,
  isLoading = false,
}: ClassListTableProps) {
  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-primary";
      case "Intermediate":
        return "bg-yellow-500";
      case "Advanced":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No classes found. Create your first class to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Class Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Trainer</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((classItem) => (
            <TableRow key={classItem.id}>
              <TableCell className="font-medium">{classItem.name}</TableCell>
              <TableCell className="max-w-xs truncate">
                {classItem.description || "—"}
              </TableCell>
              <TableCell>
                {classItem.difficulty ? (
                  <Badge
                    className={getDifficultyColor(classItem.difficulty)}
                  >
                    {classItem.difficulty}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{classItem.trainer_name || "—"}</TableCell>
              <TableCell>{classItem.duration_minutes} min</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(classItem)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(classItem.id)}
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

