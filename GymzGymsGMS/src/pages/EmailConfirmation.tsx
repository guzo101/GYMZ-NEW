import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type Status = "success" | "error" | "unknown";

function parseHashParams(hash: string): Record<string, string> {
  if (!hash) return {};
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  return trimmed.split("&").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (!key) return acc;
    acc[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
    return acc;
  }, {} as Record<string, string>);
}

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const { status, errorMessage } = useMemo(() => {
    const params = parseHashParams(window.location.hash);
    const error = params["error"] || params["error_code"];
    const description = params["error_description"];

    if (!error) {
      // No error param – assume Supabase accepted the link
      return {
        status: "success" as Status,
        errorMessage: "",
      };
    }

    // Map common Supabase errors to friendlier messages
    if (error === "access_denied" || error === "otp_expired") {
      return {
        status: "error" as Status,
        errorMessage:
          "This confirmation link is invalid or has already been used. If you just confirmed successfully, you can go ahead and log in. Otherwise, request a new confirmation email from your gym.",
      };
    }

    return {
      status: "error" as Status,
      errorMessage: description || "Something went wrong while confirming your email.",
    };
  }, []);

  // When dialog closes, send user to login screen
  useEffect(() => {
    if (!open) {
      navigate("/login", { replace: true });
    }
  }, [open, navigate]);

  const isSuccess = status === "success";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 flex items-center justify-center">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 flex flex-col">
          <DialogHeader className="flex-shrink-0 border-b p-6">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
              {isSuccess ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  Email Confirmed
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                  Email Confirmation
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 space-y-4">
            {isSuccess ? (
              <div className="space-y-3 text-center">
                <p className="text-base font-semibold text-foreground">
                  Your email has been verified successfully.
                </p>
                <p className="text-sm text-muted-foreground">
                  You can now return to the Gymz mobile app and{" "}
                  <span className="font-semibold">log in with your email and password.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-base font-semibold text-foreground">
                  We couldn&apos;t verify this link.
                </p>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            )}
            <div className="pt-2 flex justify-center">
              <Button
                className="min-w-[160px]"
                onClick={() => setOpen(false)}
              >
                Go to Login
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}





