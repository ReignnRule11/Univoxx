"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ContentCard } from "@/components/content-card";
import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/hooks/use-api";
import type { PublicContent } from "@/lib/ui-types";

type Comment = { id: string; authorId: string; body: string; createdAt: string };

export default function ContentPage() {
  const params = useParams<{ contentId: string }>();
  const contentId = params.contentId;
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const query = useApi<{ content: PublicContent }>(user ? `/api/v1/content/${contentId}` : null, tick);
  const comments = useApi<{ comments: Comment[] }>(user ? `/api/v1/content/${contentId}/comments` : null, tick);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onComment(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setMessage("Write a comment first");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/content/${contentId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setBody("");
      setMessage("Comment posted");
      setTick((value) => value + 1);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <PageHeader kicker="Content" title="Story" lede="Read, react, and leave a comment. Views are counted once per viewer." />
      <RequireAuth>
        {query.loading ? <LoadingState label="Loading content" /> : null}
        {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
        {query.data ? (
          <div className="stack">
            <ContentCard item={query.data.content} viewerId={user?.user.id} onChanged={() => setTick((value) => value + 1)} />
            <Card>
              <h2>Comments</h2>
              <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void onComment(event)}>
                <Field label="Add a comment" htmlFor="comment">
                  <textarea id="comment" value={body} onChange={(event) => setBody(event.target.value)} />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? "Posting" : "Post comment"}
                </Button>
              </form>
              {message ? <StatusMessage tone={message === "Comment posted" ? "ok" : "error"}>{message}</StatusMessage> : null}
              {!comments.data?.comments.length ? (
                <EmptyState title="No comments yet" body="Be the first to reply." />
              ) : (
                <div className="stack" style={{ marginTop: 16 }}>
                  {comments.data.comments.map((comment) => (
                    <article key={comment.id} className="card quiet">
                      <p>{comment.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </RequireAuth>
    </main>
  );
}
