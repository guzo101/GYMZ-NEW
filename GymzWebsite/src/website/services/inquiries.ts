import { supabase } from "@/integrations/supabase/client";

export interface WebsiteInquiryPayload {
  full_name: string;
  email: string;
  phone?: string;
  interest?: string;
  preferred_contact?: string;
  message?: string;
}

export async function submitWebsiteInquiry(payload: WebsiteInquiryPayload) {
  const { data, error } = await supabase
    .from("website_inquiries")
    .insert({
      ...payload,
      source: "marketing_site",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}


