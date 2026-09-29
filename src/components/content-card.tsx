"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { PublicContent } from "@/lib/ui-types";
import { Badge, Button, StatusMessage } from "./ui";

export function ContentCard({
  item,
  viewerId,
  onChanged,
}: {
  item: PublicContent;
  viewerId?: string;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const own = viewerId === item.authorId;

  async function react() {
    setBusy("react");
    setMessage(null);
    try {
      await apiFetch(`/api/v1/content/${item.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji: "heart" }),
      });
      setMessage("Reaction saved");
      onChanged?.();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setMessage(null);
    try {
      await apiFetch(`/api/v1/content/${item.id}/shares`, { method: "POST" });
      const url = `${window.location.origin}/content/${item.id}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setMessage("Share recorded");
      onChanged?.();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card content-card">
      <div className="cluster" style={{ marginBottom: 8 }}>
        <Badge>{item.type}</Badge>
        <Badge>{item.visibility}</Badge>
        {item.status !== "PUBLISHED" ? <Badge>{item.status}</Badge> : null}
      </div>
      <p className="meta">{formatDate(item.publishedAt ?? item.createdAt)}</p>
      <h3>
        <Link href={`/content/${item.id}`}>{item.title}</Link>
      </h3>
      {item.body ? <p className="lede">{item.body}</p> : null}
      {item.media.length ? (
        <p className="lede" style={{ marginTop: 8 }}>
          {item.media.length} media attachment{item.media.length === 1 ? "" : "s"}
        </p>
      ) : null}
      <div className="cluster" style={{ marginTop: 16 }}>
        <Button type="button" variant="secondary" onClick={() => void react()} disabled={busy !== null}>
          {busy === "react" ? "Saving" : "Like"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void share()} disabled={busy !== null}>
          {busy === "share" ? "Sharing" : "Share"}
        </Button>
        {!own ? (
          <Link className="btn secondary" href={`/creators/${item.authorId}`}>
            Creator
          </Link>
        ) : null}
      </div>
      {message ? <StatusMessage tone={message === "Reaction saved" || message === "Share recorded" ? "ok" : "error"}>{message}</StatusMessage> : null}
    </article>
  );
}
