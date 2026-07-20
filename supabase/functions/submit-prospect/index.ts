import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * submit-prospect
 *
 * Single frontend entry point for project intake.
 * Inserts a prospect row, then fans out to notifiers.
 *
 * Secrets (Dashboard → Project Settings → Edge Functions → Secrets):
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID    — your user/group/channel id (message the bot once, then read chat.id)
 */

type ProspectPayload = {
  project?: string;
  timeline?: string;
  budget?: string;
  email?: string;
  message?: string | null;
};

type ProspectRow = {
  id: string;
  project: string;
  timeline: string;
  budget: string;
  email: string;
  message: string | null;
  created_at: string;
};

type Notifier = {
  name: string;
  send: (prospect: ProspectRow) => Promise<void>;
};

const ALLOWED_TIMELINES = new Set(["asap", "1-3-months", "exploring"]);
const ALLOWED_BUDGETS = new Set(["under-2k", "2k-5k", "5k-plus"]);

const TIMELINE_LABELS: Record<string, string> = {
  asap: "ASAP",
  "1-3-months": "1–3 months",
  exploring: "Just exploring",
};

const BUDGET_LABELS: Record<string, string> = {
  "under-2k": "< €2k",
  "2k-5k": "€2k–5k",
  "5k-plus": "€5k+",
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Escape text for Telegram HTML parse_mode. */
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function notifyTelegram(prospect: ProspectRow) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    console.warn(
      "[notify] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping Telegram",
    );
    return;
  }

  const timeline = TIMELINE_LABELS[prospect.timeline] ?? prospect.timeline;
  const budget = BUDGET_LABELS[prospect.budget] ?? prospect.budget;

  const lines = [
    "<b>New project intake</b>",
    "",
    `<b>Project</b>\n${escapeHtml(prospect.project)}`,
    `<b>Timeline</b>  ${escapeHtml(timeline)}`,
    `<b>Budget</b>  ${escapeHtml(budget)}`,
    `<b>Email</b>  ${escapeHtml(prospect.email)}`,
  ];

  if (prospect.message) {
    lines.push(`<b>Message</b>\n${escapeHtml(prospect.message)}`);
  }

  lines.push(`<i>id ${escapeHtml(prospect.id)}</i>`);

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram sendMessage failed (${res.status}): ${text}`);
  }
}

const NOTIFIERS: Notifier[] = [{ name: "telegram", send: notifyTelegram }];

async function dispatchNotifications(prospect: ProspectRow) {
  const results = await Promise.allSettled(
    NOTIFIERS.map(async (notifier) => {
      await notifier.send(prospect);
      return notifier.name;
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[notify] failed:", result.reason);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body: ProspectPayload;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const project = clean(body.project, 500);
  const timeline = clean(body.timeline, 64);
  const budget = clean(body.budget, 64);
  const email = clean(body.email, 254).toLowerCase();
  const messageRaw = clean(body.message, 2000);
  const message = messageRaw.length > 0 ? messageRaw : null;

  if (project.length < 2) {
    return json(400, { error: "Project description is required" });
  }
  if (!ALLOWED_TIMELINES.has(timeline)) {
    return json(400, { error: "Invalid timeline" });
  }
  if (!ALLOWED_BUDGETS.has(budget)) {
    return json(400, { error: "Invalid budget" });
  }
  if (!isEmail(email)) {
    return json(400, { error: "Valid email is required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[submit-prospect] missing service credentials");
    return json(500, { error: "Server misconfigured" });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("prospects")
    .insert({ project, timeline, budget, email, message })
    .select("id, project, timeline, budget, email, message, created_at")
    .single();

  if (error || !data) {
    console.error("[submit-prospect] insert failed:", error);
    return json(500, { error: "Could not save request" });
  }

  void dispatchNotifications(data as ProspectRow);

  return json(200, {
    ok: true,
    id: data.id,
    estimatedResponse: "Within 48 hours",
  });
});
