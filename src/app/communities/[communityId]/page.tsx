"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/hooks/use-api";
import type { PublicChannel, PublicCommunity, PublicPost } from "@/lib/ui-types";

export default function CommunityDetailPage() {
  const params = useParams<{ communityId: string }>();
  const communityId = params.communityId;
  const { user } = useSession();
  const community = useApi<{ community: PublicCommunity }>(user ? `/api/v1/communities/${communityId}` : null);
  const channels = useApi<{ channels: PublicChannel[] }>(user ? `/api/v1/communities/${communityId}/channels` : null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const selectedId = channelId ?? channels.data?.channels[0]?.id ?? null;
  const posts = useApi<{ posts: PublicPost[] }>(
    user && selectedId ? `/api/v1/communities/${communityId}/channels/${selectedId}/posts` : null,
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onPost(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) {
      return;
    }
    if (title.trim().length < 1 || body.trim().length < 1) {
      setMessage("Title and body are required");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/communities/${communityId}/channels/${selectedId}/posts`, {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });
      setTitle("");
      setBody("");
      setMessage("Post published");
      await posts.reload();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const selected = channels.data?.channels.find((channel) => channel.id === selectedId) ?? channels.data?.channels[0];

  return (
    <main id="main" className="app-main">
      <RequireAuth>
        {community.loading ? <LoadingState label="Loading community" /> : null}
        {community.error ? <ErrorState message={community.error} onRetry={() => void community.reload()} /> : null}
        {community.data ? (
          <>
            <PageHeader
              kicker="Community"
              title={community.data.community.name}
              lede={community.data.community.description || "Channels and posts for this community."}
              actions={
                <>
                  <Badge>{community.data.community.visibility}</Badge>
                  <Link className="btn secondary" href="/studio/community">
                    Studio
                  </Link>
                </>
              }
            />
            {channels.loading ? <LoadingState label="Loading channels" /> : null}
            {channels.error ? <ErrorState message={channels.error} onRetry={() => void channels.reload()} /> : null}
            {!channels.loading && !channels.data?.channels.length ? (
              <EmptyState title="No channels yet" body="A moderator can create the first channel from Studio." />
            ) : (
              <div className="grid-cards two">
                <Card>
                  <h2>Channels</h2>
                  <div className="stack" style={{ marginTop: 12 }}>
                    {channels.data?.channels.map((channel) => (
                      <Button
                        key={channel.id}
                        type="button"
                        variant={channel.id === (channelId ?? selected?.id) ? "primary" : "secondary"}
                        onClick={() => setChannelId(channel.id)}
                      >
                        {channel.name}
                      </Button>
                    ))}
                  </div>
                </Card>
                <Card>
                  <h2>{selected?.name ?? "Posts"}</h2>
                  {selected ? (
                    <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void onPost(event)}>
                      <Field label="Title" htmlFor="post-title">
                        <input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} />
                      </Field>
                      <Field label="Body" htmlFor="post-body">
                        <textarea id="post-body" value={body} onChange={(event) => setBody(event.target.value)} />
                      </Field>
                      <Button type="submit" disabled={busy || !selected}>
                        {busy ? "Posting" : "Post"}
                      </Button>
                    </form>
                  ) : null}
                  {message ? (
                    <StatusMessage tone={message === "Post published" ? "ok" : "error"}>{message}</StatusMessage>
                  ) : null}
                  {posts.loading ? <LoadingState label="Loading posts" /> : null}
                  {!posts.loading && selected && !posts.data?.posts.length ? (
                    <p className="lede" style={{ marginTop: 16 }}>
                      No posts in this channel yet.
                    </p>
                  ) : (
                    <div className="stack" style={{ marginTop: 16 }}>
                      {posts.data?.posts.map((post) => (
                        <article key={post.id} className="card quiet">
                          <h3>{post.title}</h3>
                          <p className="lede">{post.body}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </>
        ) : null}
      </RequireAuth>
    </main>
  );
}
