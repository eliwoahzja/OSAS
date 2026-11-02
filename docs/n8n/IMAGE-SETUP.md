# Enable image reading in the LIVE OSAS n8n workflow

The OSAS site and deployed Supabase `agent-chat` function now support one JPEG, PNG, or WebP image attachment per admin message, up to 2 MB. Students do not have AI image analysis access.

**The live n8n workflow must also enable vision.** The committed template `docs/n8n/osas-admin-agent.workflow.json` has these changes, but editing a GitHub file does **not** publish them to n8n Cloud.

Use your existing **OSAS Administrative Agent** workflow so its credentials, current system message, and parent-notification tools remain intact.

1. In n8n, open **OSAS Administrative Agent** → **Editor**.
2. Insert a **Code** node named **Prepare Vision Input** between the **true** output of **Check Secret** and **AI Agent**. Set **Run Once for All Items**.
3. Paste:

```js
const item = $input.first();
const image = item.json?.body?.image;
if (!image) return [item];
if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType)) {
  throw new Error('Unsupported image type');
}
if (typeof image.data !== 'string' || image.data.length > 2800000) {
  throw new Error('Image too large');
}
const extension = image.mimeType === 'image/png' ? 'png' :
  image.mimeType === 'image/webp' ? 'webp' : 'jpg';
return [{
  json: item.json,
  binary: {
    ...(item.binary || {}),
    image: {
      data: image.data,
      mimeType: image.mimeType,
      fileName: image.fileName || ('image.' + extension),
      fileExtension: extension,
    },
  },
}];
```

4. In **AI Agent** → **Options**, enable **Automatically Passthrough Binary Images**. The connected model must support vision. Do not change its existing API credentials. Keep the existing prompt and tools connected.
5. In **Respond to Administrator**, set the JSON response expression to:

```js
={{ JSON.stringify({
  reply: $json.output,
  imageProcessed: Boolean($('OSAS Webhook').first().json.body.image),
}) }}
```

6. Save and **Publish**. Test a harmless image containing printed text by attaching it in OSAS desk. A correct workflow returns extracted text or an image description.

If the n8n response lacks `imageProcessed: true`, the gateway rejects the image response so the AI cannot falsely claim it saw an image. Text-only messages continue using the original pipeline.

Images are transmitted only for the current request. Chat history stores image filenames, not the original image bytes. Use the system only with images you are authorized to process, especially when school records or other student data are involved.
