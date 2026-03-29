/**
 * Event Check-in Barcode Display
 * Displays a QR code for a selected event. Members scan it at the event venue.
 * Same GMS, same verification - admin uses this at events.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import { CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Event {
  id: string;
  title: string;
  event_date: string;
}

export function EventCheckInBarcodeDisplay() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const gymId = (user as any)?.gymId;

  useEffect(() => {
    if (!gymId) {
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id, title, event_date")
          .eq("gym_id", gymId)
          .eq("is_active", true)
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true })
          .limit(20);

        if (error) throw error;
        const list = (data as Event[]) || [];
        setEvents(list);
        if (list.length > 0) {
          setSelectedEventId((prev) => prev || list[0].id);
        }
      } catch (err) {
        console.error("[EventBarcode] Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [gymId]);

  if (!gymId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Event Check-in Barcode
          </CardTitle>
          <CardDescription>
            Display at event venue for member self-check-in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You need to be assigned to a gym to display event barcodes.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const eventQrString = selectedEventId
    ? `gymz_event_checkin:${selectedEventId}:checkin`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Event Check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No upcoming events.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Select value={selectedEventId || ""} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.title} — {format(new Date(ev.event_date), "MMM d, h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventQrString && selectedEvent && (
              <>
                <div className="flex justify-center bg-white p-6 rounded-lg border">
                  <QRCodeSVG value={eventQrString} size={220} level="M" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {selectedEvent.title}
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
