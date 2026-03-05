export interface WebhookPayload {
  full_name: string;
  email: string;
  phone?: string;
  inquiry_type?: string;
  interest?: string;
  message?: string;
  source?: string;
}

export async function sendToMakeWebhook(payload: WebhookPayload): Promise<boolean> {
  const webhookUrl = "https://hook.eu2.make.com/73oa7gubrayjuavgupd3amxd2flch7fq";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: payload.source || "website",
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error sending to Make.ai webhook:", error);
    throw error;
  }
}

