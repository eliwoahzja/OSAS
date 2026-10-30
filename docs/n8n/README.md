# OSAS Administrative Agent (n8n + Gemini)

The in-dashboard **Assistant** button is available to administrators. It sends the
conversation to the `agent-chat` Supabase Edge Function, which verifies the
administrator's session and relays the request to n8n. n8n uses Gemini to decide
which read or write action to call. Every action goes through the `agent-tools`
gateway, which re-checks the administrator, validates the fields, writes an audit
row, and performs the operation.

n8n never receives a Supabase service-role key. The only secrets it holds are the
n8n webhook secret (to accept calls from `agent-chat`) and the Gemini API key.

## 1. Create the n8n workflow

1. Sign in to [n8n Cloud](https://n8n.cloud/) and create a workspace.
2. Open **Workflows → Add workflow → Import from File**.
3. Import [`osas-admin-agent.workflow.json`](./osas-admin-agent.workflow.json).
4. Open the **Google Gemini** node and create a **Google Gemini(PaLM) API**
   credential with a key from [Google AI Studio](https://aistudio.google.com/apikey).
   Select the credential. The workflow uses `models/gemini-2.5-flash`; change it
   if your account uses a different model.
5. Open the **Check Secret** node and replace
   `REPLACE_WITH_N8N_WEBHOOK_SECRET` with the webhook secret you will store in
   Supabase. This is the secret that proves a request came from `agent-chat`.
6. Save the workflow, then click **Activate**.
7. Copy the **Production URL** shown by the **OSAS Webhook** node. It looks like
   `https://<workspace>.app.n8n.cloud/webhook/osas-admin-agent`.

## 2. Configure Supabase secrets

Generate two long random values (at least 32 bytes each). Store them only in
Supabase and in the n8n **Check Secret** node:

```powershell
supabase secrets set `
  AGENT_GATEWAY_KEY="<random-gateway-key>" `
  N8N_WEBHOOK_SECRET="<random-webhook-secret>" `
  N8N_AGENT_WEBHOOK_URL="https://<workspace>.app.n8n.cloud/webhook/osas-admin-agent" `
  --project-ref rwqaeabxusivkyjgskko
```

- `AGENT_GATEWAY_KEY` signs the 15-minute tool tokens minted by `agent-chat` and
  verified by `agent-tools`. n8n never sees it.
- `N8N_WEBHOOK_SECRET` is sent by `agent-chat` in the `x-agent-key` header and
  checked by the **Check Secret** node.
- `N8N_AGENT_WEBHOOK_URL` is the production webhook URL from step 1.

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
- The n8n webhook URL is public by nature. The webhook secret and the signed
  actor token are what prevent unauthorized use.
