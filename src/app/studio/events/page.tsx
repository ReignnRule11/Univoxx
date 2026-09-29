"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { PublicEvent } from "@/lib/ui-types";

export default function StudioEventsPage() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const query = useApi<{ events: PublicEvent[] }>(user ? "/api/v1/events" : null, tick);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [accessType, setAccessType] = useState("FREE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) {
      next.title = "Title is required";
    }
    if (!startsAt) {
      next.startsAt = "Start time is required";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({
          title,
          startsAt: new Date(startsAt).toISOString(),
          accessType,
        }),
      });
      setTitle("");
      setOk(true);
      setMessage("Draft event created");
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
      await apiFetch(`/api/v1/events/${id}/publish`, { method: "POST" });
      setOk(true);
      setMessage("Event published");
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
      <PageHeader kicker="Studio" title="Events" lede="Draft, publish, then start the room from Live. Production rooms need Daily or LiveKit." />
      <div className="grid-cards two">
        <Card>
          <h2>Schedule</h2>
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void onCreate(event)} noValidate>
            <Field label="Title" htmlFor="title" error={errors.title}>
              <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Starts at" htmlFor="startsAt" error={errors.startsAt}>
              <input id="startsAt" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            </Field>
            <Field label="Access" htmlFor="accessType">
              <select id="accessType" value={accessType} onChange={(event) => setAccessType(event.target.value)}>
                <option value="FREE">Free</option>
                <option value="SUBSCRIBER">Subscriber</option>
                <option value="PAID">Paid</option>
              </select>
            </Field>
            <Button type="submit" disabled={busy}>
              Save draft
            </Button>
          </form>
          {message ? <StatusMessage tone={ok ? "ok" : "error"}>{message}</StatusMessage> : null}
        </Card>
        <div className="stack">
          {query.loading ? <LoadingState label="Loading events" /> : null}
          {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
          {!query.loading && !query.data?.events.length ? (
            <EmptyState title="No events" body="Create a draft, publish it, then open the room." />
          ) : (
            query.data?.events.map((item) => (
              <Card key={item.id} quiet>
                <div className="cluster">
                  <Badge tone={item.status === "LIVE" ? "live" : undefined}>{item.status}</Badge>
                  <Badge>{item.accessType}</Badge>
                </div>
                <h3 style={{ marginTop: 8 }}>{item.title}</h3>
                <p className="lede">{formatDate(item.startsAt)}</p>
                <div className="cluster" style={{ marginTop: 12 }}>
                  {item.status === "DRAFT" ? (
                    <Button type="button" disabled={busy} onClick={() => void publish(item.id)}>
                      Publish
                    </Button>
                  ) : null}
                  <Link className="btn secondary" href={`/live/${item.id}`}>
                    Open room
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
