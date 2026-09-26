import { NextResponse } from "next/server";
import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { getRecordingFile } from "@/modules/events/event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const file = await getRecordingFile(auth.user, context.params.eventId, context.params.recordingId);
  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${context.params.recordingId}"`,
    },
  });
});

export const OPTIONS = apiOptions();
