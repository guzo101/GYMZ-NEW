/* @ts-nocheck */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

interface TransactionVerificationProps {
  open: boolean;
  paymentId: string;
  onClose: () => void;
  onVerified: () => void;
}

export function TransactionVerification({ open, paymentId, onClose, onVerified }: TransactionVerificationProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!transactionId.trim()) {
      setError("Please enter a transaction ID");
      return;
    }

    if (!user?.id) {
      setError("User not found");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // First, check if this transaction ID has been used before
      const { data: existingPayments, error: checkError } = await db
        .from("payments")
        .select("id, transaction_reference, status, user_id")
        .eq("transaction_reference", transactionId.trim())
        .eq("status", "completed");

      if (checkError) {
        throw checkError;
      }

      // Check if transaction ID was already used by another payment
      if (existingPayments && existingPayments.length > 0) {
        const usedByOther = existingPayments.some(p => p.id !== paymentId);
        if (usedByOther) {
          setError("This transaction ID has already been used. Please contact admin for approval.");
          setLoading(false);
          return;
        }
      }

      // Update the payment with transaction ID and mark as completed
      const { error: updateError } = await db
        .from("payments")
        .update({
          transaction_reference: transactionId.trim(),
          status: "completed",
          verified_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      // Update user membership status to Active
      const { error: userUpdateError } = await db
        .from("users")
        .update({ membership_status: "Active" })
        .eq("id", user.id);

      if (userUpdateError) {
        console.warn("Failed to update user membership status:", userUpdateError);
      }

      toast({
        title: "Verification Successful",
        description: "Your payment has been verified and your membership is now active!",
      });

      onVerified();
      onClose();
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Failed to verify transaction. Please try again or contact admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAdminApproval = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Create a notification for admin
      await db.from("notifications").insert({
        message: `Payment verification requested by ${user.name || "Member"}. Payment ID: ${paymentId}`,
        user_id: user.id,
        type: "payment",
        payment_id: paymentId,
        action_url: `/finances`,
        action_label: "Review Payment",
      });

      toast({
        title: "Request Sent",
        description: "Admin has been notified. You'll be notified once your payment is approved.",
      });

      onClose();
    } catch (err: any) {
      console.error("Error requesting admin approval:", err);
      toast({
        title: "Error",
        description: "Failed to send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Your Payment</DialogTitle>
          <DialogDescription>
            Enter your transaction ID to verify your payment and activate your membership immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="transactionId">Transaction ID / Reference Number</Label>
            <Input
              id="transactionId"
              type="text"
              value={transactionId}
              onChange={(e) => {
                setTransactionId(e.target.value);
                setError("");
              }}
              placeholder="Enter your transaction reference"
              className="mt-1"
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Each transaction ID can only be used once. If you've already used this ID, please request admin approval instead.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleVerify}
              disabled={loading || !transactionId.trim()}
              className="flex-1"
            >
              {loading ? "Verifying..." : "Verify Payment"}
            </Button>
            <Button
              variant="outline"
              onClick={handleRequestAdminApproval}
              disabled={loading}
            >
              Request Admin Approval
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

