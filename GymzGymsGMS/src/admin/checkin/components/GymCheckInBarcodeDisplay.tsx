/**
 * Gym Check-in Barcode Display
 * Displays a QR code that members scan at the gym entrance for self-check-in.
 * The admin displays this at the entrance; members scan it with their app.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, MonitorSmartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface BarcodeData {
  code: string;
  qr_string: string;
  expires_at: string;
}

export function GymCheckInBarcodeDisplay() {
  const { user } = useAuth();
  const [barcode, setBarcode] = useState<BarcodeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBarcode = useCallback(async () => {
    const gymId = (user as any)?.gymId;
    if (!gymId) {
      toast.error("Gym not found. Please ensure you are assigned to a gym.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("generate_gym_checkin_barcode", {
        p_gym_id: gymId,
      });

      if (rpcError) throw rpcError;
      if (!data || typeof data !== "object") throw new Error("No barcode data returned");

      const qrString = data.qr_string ?? data.qrString;
      const code = data.code ?? "";
      const expiresAt = data.expires_at ?? data.expiresAt;
      if (!qrString) throw new Error("Invalid barcode format");

      setBarcode({
        code,
        qr_string: qrString,
        expires_at: expiresAt,
      });
    } catch (err: any) {
      console.error("[GymCheckInBarcode] Error:", err);
      const msg = err?.message || "Failed to generate barcode";
      setError(msg);
      toast.error(msg);
      setBarcode(null);
    } finally {
      setLoading(false);
    }
  }, [(user as any)?.gymId]);

  useEffect(() => {
    fetchBarcode();
  }, [fetchBarcode]);

  if (!(user as any)?.gymId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5" />
            Gym Check-in Barcode
          </CardTitle>
          <CardDescription>
            Display this at the gym entrance so members can scan to self-check-in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You need to be assigned to a gym to display the check-in barcode.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5" />
          Live Gym Check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : barcode ? (
          <>
            <div className="flex justify-center bg-white p-6 rounded-lg border">
              <QRCodeSVG value={barcode.qr_string} size={220} level="M" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Valid until {format(new Date(barcode.expires_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={fetchBarcode}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Barcode
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button onClick={fetchBarcode} disabled={loading}>
              {loading ? "Loading..." : "Generate Barcode"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
