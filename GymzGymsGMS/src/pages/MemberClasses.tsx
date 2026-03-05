/* @ts-nocheck */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Users, CheckCircle } from "lucide-react";
import { getSchedulesByDateRange, ClassSchedule } from "@/admin/gym-calendar/api/schedules";
import { format } from "date-fns";

interface ClassWithBookings {
  id: string;
  name: string;
  coach: string | null;
  location: string | null;
  room: string | null;
  start: string | null;
  end: string | null;
  type: string | null;
  capacity: number | null;
  date: string | null;
  color: string | null;
  bookings: { user_id: string }[];
  schedule_id?: string;
  slots_available?: number;
}

export default function MemberClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses(dateFilter?: string) {
    setLoading(true);
    setError(null);
    try {
      // Fetch from new gym calendar system
      const today = new Date();
      const startDate = dateFilter || format(today, "yyyy-MM-dd");
      const endDate = dateFilter || format(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"); // 30 days ahead
      
      const schedules = await getSchedulesByDateRange(startDate, endDate);
      
      // Fetch user bookings for gym schedules
      let userBookings: string[] = [];
      if (user?.id) {
        const { data: bookingsData } = await db
          .from("gym_class_bookings")
          .select("schedule_id")
          .eq("user_id", user.id);
        userBookings = (bookingsData || []).map((b: any) => b.schedule_id);
      }

      // Transform schedules to match the expected format
      const transformedClasses: ClassWithBookings[] = schedules.map((schedule: ClassSchedule) => {
        const classData = schedule.gym_classes;
        const isBooked = userBookings.includes(schedule.id);
        
        return {
          id: schedule.id,
          schedule_id: schedule.id,
          name: classData?.name || "Unknown Class",
          coach: classData?.trainer_name || null,
          location: null,
          room: schedule.room || null,
          start: schedule.start_time || null,
          end: schedule.end_time || null,
          type: classData?.difficulty || null,
          capacity: schedule.slots_available || null,
          date: schedule.date || null,
          color: null,
          slots_available: schedule.slots_available,
          bookings: isBooked ? [{ user_id: user?.id || "" }] : [],
        };
      });

      // Also fetch old classes table for backward compatibility
      let oldClassesQuery = db
        .from("classes")
        .select("id, name, coach, location, room, start, end, type, capacity, date, color, bookings ( user_id )")
        .order("date", { ascending: true })
        .order("start", { ascending: true });

      if (dateFilter) {
        oldClassesQuery = oldClassesQuery.eq("date", dateFilter);
      }

      const { data: oldClassesData, error: oldClassesError } = await oldClassesQuery;
      
      // Combine both old and new classes
      const allClasses = [
        ...transformedClasses,
        ...(oldClassesData || []),
      ];

      // Sort by date and time
      allClasses.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (!a.start || !b.start) return 0;
        return a.start.localeCompare(b.start);
      });

      setClasses(allClasses);
    } catch (error) {
      console.error(error);
      setError("Unable to load classes right now.");
      setClasses([]);
    }
    setLoading(false);
  }

  async function handleToggleBooking(cls: ClassWithBookings, isBooked: boolean) {
    if (!user?.id) return;
    setProcessingId(cls.id);
    try {
      // Check if this is a new gym calendar schedule or old class
      if (cls.schedule_id) {
        // New gym calendar system - use schedule_id
        // For now, we'll use a simple approach - store in a bookings table with schedule_id
        if (isBooked) {
          await db.from("gym_class_bookings").delete().match({ 
            user_id: user.id, 
            schedule_id: cls.schedule_id 
          }).catch(() => {
            // If table doesn't exist, try alternative approach
            return db.from("bookings").delete().match({ 
              user_id: user.id, 
              schedule_id: cls.schedule_id 
            });
          });
        } else {
          await db.from("gym_class_bookings").insert([{ 
            user_id: user.id, 
            schedule_id: cls.schedule_id 
          }]).catch(() => {
            // If table doesn't exist, try alternative approach
            return db.from("bookings").insert([{ 
              user_id: user.id, 
              schedule_id: cls.schedule_id 
            }]);
          });
        }
      } else {
        // Old classes system
        if (isBooked) {
          await db.from("books").delete().match({ user_id: user.id, class_id: cls.id });
        } else {
          await db.from("bookings").insert([{ user_id: user.id, class_id: cls.id }]);
        }
      }
      await fetchClasses(selectedDate || undefined);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while updating your booking. Please try again.");
    } finally {
      setProcessingId(null);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary";
      case "full":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-primary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Available";
      case "full":
        return "Full";
      case "cancelled":
        return "Cancelled";
      default:
        return "Scheduled";
    }
  };

  const getTypeColor = (cls: ClassWithBookings) => {
    // Use stored color if available
    if (cls.color) {
      return cls.color;
    }
    // Fallback to type-based colors
    switch (cls.type) {
      case "Yoga":
        return "bg-primary";
      case "HIIT":
        return "bg-orange-500";
      case "Cardio":
        return "bg-primary";
      case "Strength":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const enriched = useMemo(
    () =>
      classes.map((cls) => {
        const enrolled = cls.bookings?.length ?? 0;
        const capacity = cls.capacity ?? 0;
        const isBooked = !!cls.bookings?.some((b) => b.user_id === user?.id);
        const isFull = capacity > 0 && enrolled >= capacity;
        return { ...cls, enrolled, capacity, isBooked, isFull };
      }),
    [classes, user?.id]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Your calendar fills up fast. Lock in your training blocks now so life has to work around your goals—not the other way around.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedDate(value);
              fetchClasses(value || undefined);
            }}
            className="w-full sm:w-auto"
          />
          <Button variant="outline" size="sm" onClick={() => { setSelectedDate(""); fetchClasses(); }}>
            Clear filter
          </Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Active classes</p>
              <p className="text-2xl font-bold">{enriched.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total spots today</p>
              <p className="text-2xl font-bold">
                {enriched.reduce((sum, c) => sum + (c.capacity || 0), 0)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your bookings</p>
              <p className="text-2xl font-bold">
                {enriched.filter((c) => c.isBooked).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-primary-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Available Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your class schedule...</p>
          ) : enriched.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No classes are scheduled yet. As soon as your gym adds sessions, they&apos;ll appear here ready to book.
            </p>
          ) : (
            <div className="space-y-4">
              {enriched.map((cls) => (
                <div
                  key={cls.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-center min-w-[90px]">
                      <div className="text-xs text-muted-foreground">
                        {cls.date ? new Date(cls.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBA"}
                      </div>
                      <div className="text-sm font-medium">
                        {cls.start ? cls.start.slice(0, 5) : "TBD"}
                        {cls.end && ` - ${cls.end.slice(0, 5)}`}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-primary">{cls.name}</h3>
                        {cls.type && (
                          <Badge 
                            className="text-white text-2xs" 
                            style={{ backgroundColor: getTypeColor(cls) }}
                          >
                            {cls.type}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
                        <span>Coach: {cls.coach || "TBD"}</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {cls.location || cls.room || "Studio"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {cls.enrolled} / {cls.capacity ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">enrolled</div>
                    </div>
                    <Badge className={`${getStatusColor(cls.isFull ? "full" : "active")} text-white`}>
                      {getStatusText(cls.isFull ? "full" : "active")}
                    </Badge>
                    <Button
                      size="sm"
                      disabled={processingId === cls.id || cls.isFull}
                      variant={cls.isBooked ? "outline" : "default"}
                      onClick={() => handleToggleBooking(cls, cls.isBooked)}
                    >
                      {processingId === cls.id
                        ? "Saving..."
                        : cls.isBooked
                        ? "Cancel"
                        : cls.isFull
                        ? "Full"
                        : "Book"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


