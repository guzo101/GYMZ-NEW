/**
 * Gym Calendar Manager - Main Router
 * Admin feature for managing gym classes and schedules
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassesPage } from "./pages/ClassesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { CalendarPage } from "./pages/CalendarPage";
import { Calendar, List, Clock } from "lucide-react";

export function GymCalendarManager() {
  const [activeTab, setActiveTab] = useState("classes");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Gym Calendar Manager</h1>
        <p className="text-muted-foreground mt-1">
          Manage classes, schedules, and view the calendar
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="classes" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Classes
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="classes" className="mt-6">
          <ClassesPage key={activeTab} />
        </TabsContent>

        <TabsContent value="schedules" className="mt-6">
          <SchedulePage key={activeTab} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarPage key={activeTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

