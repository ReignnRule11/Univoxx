"use client";

import { FormEvent, useState } from "react";
import { useSession } from "@/components/session";
import { Badge, Button, Card, ConfirmBar, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { PublicContent } from "@/lib/ui-types";

export default function StudioContentPage() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const query = useApi<{ content: PublicContent[] }>(user ? "/api/v1/content" : null, tick);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) {
      next.title = "Title is required";
    }
    if (!body.trim()) {
      next.body = "Body is required for text content";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch("/api/v1/content", {
        method: "POST",
        body: JSON.stringify({ type: "TEXT", title, body, visibility }),
      });
      setTitle("");
      setBody("");
      setOk(true);
      setMessage("Draft saved");
      setTick((value) => value + 1);
    } catch (error) {
      setOk(false);
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function publish(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/content/${id}/publish`, { method: "POST", body: JSON.stringify({}) });
      setOk(true);
      setMessage("Published");
      setTick((value) => value + 1);
    } catch (error) {
      setOk(false);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/content/${id}/archive`, { method: "POST" });
      setOk(true);
      setMessage("Archived");
      setTick((value) => value + 1);
    } catch (error) {
      setOk(false);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/content/${id}`, { method: "DELETE" });
      setPendingDelete(null);
      setOk(true);
      setMessage("Deleted");
      setTick((value) => value + 1);
    } catch (error) {
      setOk(false);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Studio" title="Content" lede="Draft, publish, and archive your work. Only you can mutate your records." />
      <div className="grid-cards two">
        <Card>
          <h2>New draft</h2>
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void onCreate(event)} noValidate>
            <Field label="Title" htmlFor="title" error={errors.title}>
              <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Body" htmlFor="body" error={errors.body}>
              <textarea id="body" value={body} onChange={(event) => setBody(event.target.value)} />
            </Field>
            <Field label="Visibility" htmlFor="visibility">
              <select id="visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                <option value="PUBLIC">Public</option>
                <option value="UNLISTED">Unlisted</option>
                <option value="FOLLOWERS">Followers</option>
                <option value="PRIVATE">Private</option>
              </select>
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving" : "Save draft"}
            </Button>
          </form>
          {message ? <StatusMessage tone={ok ? "ok" : "error"}>{message}</StatusMessage> : null}
        </Card>
        <div className="stack">
          {query.loading ? <LoadingState label="Loading content" /> : null}
          {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
          {!query.loading && !query.data?.content.length ? (
            <EmptyState title="No drafts yet" body="Save a draft to start the publishing pipeline." />
          ) : (
            query.data?.content.map((item) => (
              <Card key={item.id} quiet>
                <div className="cluster">
                  <Badge>{item.status}</Badge>
                  <Badge>{item.visibility}</Badge>
                </div>
                <h3 style={{ marginTop: 8 }}>{item.title}</h3>
                <p className="lede">{formatDate(item.updatedAt)}</p>
                {pendingDelete === item.id ? (
                  <div style={{ marginTop: 12 }}>
                    <ConfirmBar
                      message="Delete this content? This cannot be undone from Studio."
                      confirmLabel="Delete"
                      busy={busy}
                      onConfirm={() => void remove(item.id)}
                      onCancel={() => setPendingDelete(null)}
                    />
                  </div>
                ) : (
                  <div className="cluster" style={{ marginTop: 12 }}>
                    {item.status === "DRAFT" ? (
                      <Button type="button" disabled={busy} onClick={() => void publish(item.id)}>
                        Publish
                      </Button>
                    ) : null}
                    {item.status === "PUBLISHED" ? (
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => void archive(item.id)}>
                        Archive
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setPendingDelete(item.id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
