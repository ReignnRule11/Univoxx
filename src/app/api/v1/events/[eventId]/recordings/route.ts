import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { validationError } from "@/lib/errors";
import { listRecordings, requestRecording, uploadRecording } from "@/modules/events/event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const recordings = await listRecordings(auth.user, context.params.eventId);
  return json({ recordings });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => {
      throw validationError("Request must be multipart form data");
    });
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw validationError("file is required");
    }
    const recording = await uploadRecording(auth.user, context.params.eventId, {
      filename: file.name || "recording.bin",
      mimeType: file.type || "application/octet-stream",
      body: Buffer.from(await file.arrayBuffer()),
    });
    return json({ recording }, { status: 201 });
  }
  const recording = await requestRecording(auth.user, context.params.eventId);
  return json({ recording }, { status: 201 });
});

export const OPTIONS = apiOptions();
