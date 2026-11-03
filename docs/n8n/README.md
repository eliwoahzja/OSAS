# OSAS Administrative Agent (n8n + AI Model)

The in-dashboard **Assistant** button is available to administrators. It sends the
conversation to the `agent-chat` Supabase Edge Function, which verifies the
administrator's session and relays the request to n8n. n8n uses the configured language model to decide
which read or write action to call. Every action goes through the `agent-tools`
gateway, which re-checks the administrator, validates the fields, writes an audit
row, and performs the operation.

n8n never receives a Supabase service-role key. The only secrets it holds are the
n8n webhook secret (to accept calls from `agent-chat`) and the Gemini API key.

## Current production endpoint and live workflow repair

The OSAS chat gateway now targets `https://osas.app.n8n.cloud/webhook/osas-admin-assistant`.
The repository's workflow template uses the same webhook path. A GitHub change does not update
an existing n8n Cloud workflow automatically.

**Critical fix for the supplied n8n screenshot:** If `Verify Admin Token` performs an
HTTP GET to Supabase Auth with `agentToken`, and the `Is Admin` false branch runs,
remove these two nodes. `agentToken` is an HMAC-signed gateway credential, **not**
a Supabase Auth login JWT. `agent-chat` already verifies the administrator's
Supabase session, and `agent-tools` independently validates the HMAC signature
and admin role before every operation.

Connect `Admin Message` to a `Check Secret` IF node comparing the request
header `x-agent-key` against your configured `N8N_WEBHOOK_SECRET`.
Connect **true** to the AI Agent, **false** to an HTTP 401 Respond to Webhook node.
Configure the secret privately in n8n, never in the browser.
Keep the existing Claude Sonnet model if it is working, or reconnect your preferred model.

To use the corrected JSON template, import it in n8n, configure the model and
`Check Secret` node, and publish it. Deactivate the original workflow before activating
another workflow with the same webhook path. The existing template uses Gemini by
default and requires you to select a valid model and credentials.

The inbound body contains `message`, `chatInput`, `transcript`, `history`,
`sessionId`, `requestId`, and `agentToken`. Use `body.transcript` or
`body.chatInput` for the AI prompt. The final Respond to Webhook node must
return JSON containing a `reply` or `output` string.

## 1. Create the n8n workflow

1. Sign in to [n8n Cloud](https://n8n.cloud/) and create a workspace.
2. Open **Workflows → Add workflow → Import from File**.
3. Import [`osas-admin-agent.workflow.json`](./osas-admin-agent.workflow.json).
4. Open the **Google Gemini** node and create a **Google Gemini(PaLM) API**
   credential with a key from [Google AI Studio](https://aistudio.google.com/apikey).
   Select the credential and select an available model in the Model field.
5. Open the **Check Secret** node and replace
   `REPLACE_WITH_N8N_WEBHOOK_SECRET` with the webhook secret you will store in
   Supabase. This is the secret that proves a request came from `agent-chat`.
6. Save the workflow, then click **Activate**.
7. Copy the **Production URL** shown by the **OSAS Webhook** node. It looks like
   `https://osas.app.n8n.cloud/webhook/osas-admin-assistant`.

## 2. Configure Supabase secrets

Generate two long random values (at least 32 bytes each). Store them only in
Supabase and in the n8n **Check Secret** node:

```powershell
supabase secrets set `
  AGENT_GATEWAY_KEY="<random-gateway-key>" `
  N8N_WEBHOOK_SECRET="<random-webhook-secret>" `
  --project-ref rwqaeabxusivkyjgskko
```

- `AGENT_GATEWAY_KEY` signs the 15-minute tool tokens minted by `agent-chat` and
  verified by `agent-tools`. n8n never sees it.
- `N8N_WEBHOOK_SECRET` is sent by `agent-chat` in the `x-agent-key` header and
  checked by the **Check Secret** node.
- The current OSAS gateway targets `https://osas.app.n8n.cloud/webhook/osas-admin-assistant`.

## 3. Apply the migration and deploy

```powershell
supabase db push --linked --yes
supabase functions deploy agent-tools --no-verify-jwt --use-api --project-ref rwqaeabxusivkyjgskko --yes
supabase functions deploy agent-chat manage-accounts send-notification --use-api --project-ref rwqaeabxusivkyjgskko --yes
```

`agent-tools` intentionally has JWT verification disabled at the platform level
because n8n is not a Supabase user. It authenticates every request with the
short-lived HMAC token and re-checks the administrator role. `agent-chat` keeps
platform JWT verification and also validates the session itself.

## 4. Test

1. Sign in to the dashboard as an administrator and hard-refresh
   (`Ctrl+Shift+R`).
2. Click **Assistant** in the lower-right corner.
3. Try: “Summarize open incidents this month.”
4. Try a read-only lookup: “Find a student named Cruz.”
5. Test a confirmation flow: “Send the guardian of <student> an incident alert
   saying ...”. The assistant should show the recipient and draft before sending.

If the panel says the assistant is not connected, check
`N8N_AGENT_WEBHOOK_URL` and confirm the n8n workflow is **Active**.

## Tool contract

`agent-tools` accepts `POST` JSON:

```json
{
  "action": "find_students",
  "filters": { "query": "Cruz" },
  "request_id": "one-id-per-dashboard-message",
  "token": "<short-lived HMAC token>"
}
```

Write actions use `data` instead of `filters`. The gateway returns:

```json
{ "ok": true, "data": { ... } }
```

or

```json
{ "ok": false, "error": "A plain-language explanation." }
```

Write actions are cached by `(actor, request_id, action, input fingerprint)` so an
n8n retry cannot duplicate an incident, account, or email, while two different
writes in the same assistant turn are still applied.

## Security notes

- Only administrators can open the panel and only administrators pass the
  gateway's role check.
- The gateway uses the service role internally, so every action is explicitly
  allowlisted and validated rather than exposing arbitrary table access.
- Deletions, account changes, and emails require `confirm: true`; the system
  prompt instructs the model to obtain explicit approval first.
- `agent_audit_log` records the actor, action, redacted input, outcome, and
  affected record id. Administrators can read it; nobody can edit it through the
  dashboard.
- Rotate `AGENT_GATEWAY_KEY` and `N8N_WEBHOOK_SECRET` immediately if either is
  exposed, then update Supabase and the n8n **Check Secret** node.
- The configured endpoint is `https://osas.app.n8n.cloud/webhook/osas-admin-assistant`. The n8n webhook URL is public by nature. The webhook secret and the signed
  actor token are what prevent unauthorized use.
