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
import { calculateEndDate } from "@/services/secureQRService";
import { notifyPaymentPending } from "@/lib/notifications";

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
      // First, get the payment details to know the plan
      const { data: payment, error: paymentFetchError } = await db
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (paymentFetchError) throw paymentFetchError;

      // Check if this transaction ID has been used before
      const { data: existingPayments, error: checkError } = await db
        .from("payments")
        .select("id, transaction_reference, status, user_id")
        .eq("transaction_reference", transactionId.trim())
        .eq("status", "completed");

      if (checkError) throw checkError;

      if (existingPayments && existingPayments.length > 0) {
        const usedByOther = existingPayments.some(p => p.id !== paymentId);
        if (usedByOther) {
          setError("This transaction ID has already been used. Please contact admin for approval.");
          setLoading(false);
          return;
        }
      }

      // 1. Update Payment Record with Reference
      const { error: updateError } = await db
        .from("payments")
        .update({
          transaction_reference: transactionId.trim(),
          status: "pending_verification", // Intermediate state
          updated_at: new Date().toISOString()
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      // 2. Call Atomic Activation RPC
      // Note: User activating their own payment does not pass an admin_id
      const { data: activationResult, error: activationError } = await supabase.rpc('activate_subscription_from_payment', {
        p_payment_id: paymentId
      });

      if (activationError) throw activationError;
      if (activationResult && !activationResult.success) {
        throw new Error(activationResult.error || 'Activation failed');
      }

      // Update local state is handled by the RPC updating the DB, 
      // but we might want to refresh the UI or show success message using the result
      const newExpiry = activationResult.new_expiry;

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
      // 1. Fetch payment details
      const { data: payment, error: fetchError } = await db
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Update status to pending_approval
      const { error: updateError } = await db
        .from("payments")
        .update({
          status: "pending_approval",
          updated_at: new Date().toISOString()
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      // 3. Notify admin
      await notifyPaymentPending({
        id: paymentId,
        amount: payment.amount,
        user_id: user.id,
        member_name: user.name || user.email || "Member",
        method: payment.method || "manual",
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

