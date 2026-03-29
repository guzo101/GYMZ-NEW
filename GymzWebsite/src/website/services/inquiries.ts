import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

async function messageFromFunctionsError(error: unknown): Promise<string> {
  if (
    error instanceof FunctionsHttpError &&
    error.context &&
    typeof (error.context as Response).json === "function"
  ) {
    const j = await (error.context as Response).json().catch(() => null);
    if (
      j &&
      typeof j === "object" &&
      typeof (j as { error?: unknown }).error === "string"
    ) {
      return (j as { error: string }).error;
    }
  }
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export interface WebsiteInquiryPayload {
  full_name: string;
  email: string;
  phone?: string;
  interest?: string;
  preferred_contact?: string;
  message?: string;
  /** Owner waitlist — stored as separate columns for CRM / Make mapping */
  gym_name?: string;
  gym_location?: string;
  approx_members?: string;
  source?: string;
}

export type SubmitWebsiteInquiryResult = {
  ok: true;
  id: string;
  created_at: string;
};

/**
 * Persists to `website_inquiries` and forwards to Make (or similar) via the
 * `submit-website-inquiry` Edge Function — webhook URL stays server-side only.
 */
export async function submitWebsiteInquiry(
  payload: WebsiteInquiryPayload,
): Promise<SubmitWebsiteInquiryResult> {
  const { source, ...rest } = payload;
  const resolvedSource = source ?? "marketing_site";
  const body = {
    ...rest,
    source: resolvedSource,
  };

  const { data, error } = await supabase.functions.invoke(
    "submit-website-inquiry",
    { body },
  );

  if (error) {
    throw new Error(await messageFromFunctionsError(error));
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  ) {
    throw new Error((data as { error: string }).error);
  }

  const ok = data as SubmitWebsiteInquiryResult | null;
  if (!ok?.ok || !ok.id) {
    throw new Error("Unexpected response from submit-website-inquiry");
  }
  return ok;
}
