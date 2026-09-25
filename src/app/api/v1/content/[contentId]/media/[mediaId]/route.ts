import { NextResponse } from "next/server";
import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { getMediaObject } from "@/modules/content/content-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const { media, object } = await getMediaObject(context.params.contentId, context.params.mediaId, auth.user.id);
  return new NextResponse(new Uint8Array(object.body), {
    status: 200,
    headers: {
      "content-type": object.contentType || media.mimeType,
      "content-length": String(object.body.length),
      "cache-control": "private, max-age=0, no-store",
    },
  });
});

export const OPTIONS = apiOptions();
