/* @ts-nocheck */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Users, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

interface PrivateClass {
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
  bookings?: { user_id: string }[];
}

export default function PrivateClasses() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<PrivateClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    fetchPrivateClasses();
  }, []);

  async function fetchPrivateClasses(dateFilter?: string) {
    setLoading(true);
    setError(null);
    try {
      let query = db
        .from("classes")
        .select("id, name, coach, location, room, start, end, type, capacity, date, color, bookings ( user_id )")
        .eq("type", "Private")
        .order("date", { ascending: true })
        .order("start", { ascending: true });

      if (dateFilter) {
        query = query.eq("date", dateFilter);
      }

      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        console.error(fetchError);
        setError("Unable to load private classes right now.");
        setClasses([]);
      } else {
        setClasses(data ?? []);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load private classes right now.");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (cls: PrivateClass) => {
    if (cls.color) {
      return cls.color;
    }
    return "bg-primary";
  };

  const enrichedClasses = classes.map((cls) => {
    const enrolled = cls.bookings?.length ?? 0;
    const capacity = cls.capacity ?? 1;
    const isFull = capacity > 0 && enrolled >= capacity;
    return { ...cls, enrolled, capacity, isFull };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Private Classes</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Manage private training sessions and one-on-one classes for members.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedDate(value);
              fetchPrivateClasses(value || undefined);
            }}
            className="w-full sm:w-auto"
          />
          <Button variant="outline" size="sm" onClick={() => { 
            setSelectedDate(""); 
            fetchPrivateClasses(); 
          }}>
            Clear filter
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Private Class
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Private Classes</p>
              <p className="text-2xl font-bold">{enrichedClasses.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Scheduled Today</p>
              <p className="text-2xl font-bold">
                {enrichedClasses.filter((c) => c.date === format(new Date(), "yyyy-MM-dd")).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Upcoming Sessions</p>
              <p className="text-2xl font-bold">
                {enrichedClasses.filter((c) => c.date && new Date(c.date) >= new Date()).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Private Classes Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading private classes...</p>
          ) : enrichedClasses.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                No private classes are scheduled yet.
              </p>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Private Class
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {enrichedClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-center min-w-[90px]">
                      <div className="text-xs text-muted-foreground">
                        {cls.date ? format(new Date(cls.date), "MMM dd, yyyy") : "TBA"}
                      </div>
                      <div className="text-sm font-medium">
                        {cls.start ? cls.start.slice(0, 5) : "TBD"}
                        {cls.end && ` - ${cls.end.slice(0, 5)}`}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-primary">{cls.name}</h3>
                        <Badge 
                          className="text-white text-xs" 
                          style={{ backgroundColor: getStatusColor(cls) }}
                        >
                          Private
                        </Badge>
                        {cls.isFull && (
                          <Badge variant="destructive" className="text-xs">
                            Full
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
                        {cls.enrolled} / {cls.capacity ?? 1}
                      </div>
                      <div className="text-xs text-muted-foreground">booked</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
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

