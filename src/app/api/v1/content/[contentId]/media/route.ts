import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { validationError } from "@/lib/errors";
import { uploadMedia } from "@/modules/content/content-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const form = await request.formData().catch(() => {
    throw validationError("Request must be multipart form data");
  });
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw validationError("file is required");
  }
  const body = Buffer.from(await file.arrayBuffer());
  const content = await uploadMedia(auth.user, context.params.contentId, {
    filename: file.name || "upload.bin",
    mimeType: file.type || "application/octet-stream",
    body,
  });
  return json({ content }, { status: 201 });
});

export const OPTIONS = apiOptions();
