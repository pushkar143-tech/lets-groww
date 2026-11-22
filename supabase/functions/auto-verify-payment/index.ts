import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Parse the incoming request body into a usable object.
 * Handles JSON bodies, empty bodies, and plain-text webhook payloads.
 * Never throws — returns null for unparseable input.
 */
async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (!raw || !raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract amount and UTR from either a direct JSON body or a
 * notification_text string field (common in payment-gateway webhooks).
 */
function extractPaymentFields(body: Record<string, unknown>): {
  amount: number | null;
  utr_id: string | null;
} {
  // Direct fields take priority if present
  let amount = typeof body.amount === "number" ? body.amount : null;
  let utr_id = typeof body.utr_id === "string" ? body.utr_id : null;

  const notificationText = body.notification_text;
  if (typeof notificationText === "string" && notificationText.trim()) {
    const text = notificationText.trim();

    // UTR: first 12-digit sequence
    if (!utr_id) {
      const utrMatch = text.match(/\b(\d{12})\b/);
      if (utrMatch) utr_id = utrMatch[1];
    }

    // Amount: look for patterns like "Rs. 500", "INR 500", "₹500", "amount: 500"
    if (amount == null) {
      const amountMatch = text.match(/(?:rs\.?|inr|₹|amount[:\s]*)\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (amountMatch) {
        const parsed = Number(amountMatch[1]);
        if (Number.isFinite(parsed)) amount = parsed;
      }
      // Fallback: any standalone number that looks like a currency amount
      if (amount == null) {
        const numMatch = text.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);
        if (numMatch) {
          const parsed = Number(numMatch[1]);
          if (Number.isFinite(parsed) && parsed > 0) amount = parsed;
        }
      }
    }
  }

  // Also check common alternative field names
  if (!utr_id && typeof body.transaction_id === "string") utr_id = body.transaction_id;
  if (!utr_id && typeof body.utr === "string") utr_id = body.utr;
  if (amount == null && typeof body.amount_inr === "number") amount = body.amount_inr;

  return { amount, utr_id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseBody(req);

    // Empty body = test trigger from the Supabase dashboard or a monitoring ping.
    // Return a clean 200 so the caller knows the endpoint is alive.
    if (!body) {
      return jsonResponse({
        verified: false,
        message: "Empty body received — test trigger acknowledged. No deposit was processed.",
      }, 200);
    }

    const secretKey = typeof body.secret_key === "string" ? body.secret_key : null;

    const expectedSecret = Deno.env.get("AUTO_VERIFY_SECRET");
    if (!expectedSecret) {
      return jsonResponse(
        { error: "Server not configured for auto-verification. Set AUTO_VERIFY_SECRET." },
        503,
      );
    }

    if (!secretKey || secretKey !== expectedSecret) {
      return jsonResponse({ error: "Unauthorized — invalid or missing secret_key." }, 401);
    }

    // notification_text present but empty = test trigger with auth
    const hasNotification = typeof body.notification_text === "string" && body.notification_text.trim().length > 0;
    const hasDirectFields = body.amount != null || body.utr_id != null;

    if (!hasNotification && !hasDirectFields) {
      return jsonResponse({
        verified: false,
        message: "No payment data provided (notification_text empty, no amount/utr_id). Test trigger acknowledged.",
      }, 200);
    }

    const { amount, utr_id } = extractPaymentFields(body);

    if (amount == null || amount <= 0) {
      return jsonResponse(
        { error: "A positive amount is required. Could not extract amount from the payload.", received_body: body },
        400,
      );
    }

    if (!utr_id || utr_id.length === 0) {
      return jsonResponse(
        { error: "utr_id is required. Could not extract a 12-digit UTR from the payload.", received_body: body },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Server configuration error — missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc("auto_verify_deposit", {
      p_utr: utr_id,
      p_amount: amount,
    });

    if (error) {
      console.error("auto_verify_deposit RPC failed", error);
      return jsonResponse(
        { error: "Verification failed.", details: error.message },
        500,
      );
    }

    const result = data as { found?: boolean; deposit_id?: string; amount?: number; status?: string } | null;

    if (!result?.found) {
      return jsonResponse(
        { verified: false, message: "No matching pending deposit found for this UTR.", utr: utr_id, amount },
        200,
      );
    }

    return jsonResponse({
      verified: true,
      deposit_id: result.deposit_id,
      amount: result.amount,
      status: result.status,
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("auto-verify-payment error", message);
    return jsonResponse(
      { error: "Internal server error.", details: message },
      500,
    );
  }
});
