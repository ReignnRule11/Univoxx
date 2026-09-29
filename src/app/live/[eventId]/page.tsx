"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Badge, Button, Card, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { PublicEvent } from "@/lib/ui-types";

type ChatMessage = { id: string; authorId: string; body: string; createdAt: string };
type Room = { provider: string; roomId: string; joinUrl: string; token: string; role: string; recordingSupported: boolean };

export default function LiveEventPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const query = useApi<{ event: PublicEvent }>(user ? `/api/v1/events/${eventId}` : null, tick);
  const chat = useApi<{ messages: ChatMessage[] }>(user ? `/api/v1/events/${eventId}/chat` : null, tick);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [chatBody, setChatBody] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const event = query.data?.event;
  const isHost = Boolean(user && event && user.user.id === event.hostId);

  async function run(action: string, request: () => Promise<void>) {
    setBusy(action);
    setMessage(null);
    try {
      await request();
      setTick((value) => value + 1);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function onChat(form: FormEvent) {
    form.preventDefault();
    if (!chatBody.trim()) {
      return;
    }
    await run("chat", async () => {
      await apiFetch(`/api/v1/events/${eventId}/chat`, {
        method: "POST",
        body: JSON.stringify({ body: chatBody }),
      });
      setChatBody("");
    });
  }

  return (
    <main id="main" className="app-main">
      <RequireAuth>
        {query.loading ? <LoadingState label="Loading event" /> : null}
        {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
        {event ? (
          <>
            <PageHeader
              kicker="Live"
              title={event.title}
              lede={event.description || "Join when the host opens the room."}
              actions={
                <>
                  <Badge tone={event.status === "LIVE" ? "live" : undefined}>{event.status}</Badge>
                  <Badge>{event.accessType}</Badge>
                </>
              }
            />
            <div className="grid-cards two">
              <Card>
                <p className="lede">Starts {formatDate(event.startsAt)}</p>
                {message ? <StatusMessage tone="error">{message}</StatusMessage> : null}
                <div className="cluster" style={{ marginTop: 16 }}>
                  {isHost ? (
                    <>
                      {event.status === "DRAFT" ? (
                        <Button type="button" disabled={busy !== null} onClick={() => void run("publish", async () => {
                          await apiFetch(`/api/v1/events/${eventId}/publish`, { method: "POST" });
                        })}>
                          Publish
                        </Button>
                      ) : null}
                      {event.status === "SCHEDULED" ? (
                        <Button type="button" disabled={busy !== null} onClick={() => void run("start", async () => {
                          const result = await apiFetch<{ event: PublicEvent; room: Room }>(`/api/v1/events/${eventId}/start`, { method: "POST" });
                          setRoom(result.room);
                        })}>
                          Start room
                        </Button>
                      ) : null}
                      {event.status === "LIVE" ? (
                        <Button type="button" variant="danger" disabled={busy !== null} onClick={() => void run("end", async () => {
                          await apiFetch(`/api/v1/events/${eventId}/end`, { method: "POST" });
                          setRoom(null);
                        })}>
                          End
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Button type="button" disabled={busy !== null} onClick={() => void run("register", async () => {
                        await apiFetch(`/api/v1/events/${eventId}/register`, { method: "POST", body: JSON.stringify({}) });
                        setMessage(null);
                      })}>
                        Register
                      </Button>
                      {event.status === "LIVE" ? (
                        <Button type="button" disabled={busy !== null} onClick={() => void run("join", async () => {
                          const result = await apiFetch<{ attendee: unknown; room: Room }>(`/api/v1/events/${eventId}/attendance`, { method: "POST" });
                          setRoom(result.room);
                        })}>
                          Join
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
                {room ? (
                  <p className="lede" style={{ marginTop: 16 }}>
                    Room ready on {room.provider}. Join URL: {room.joinUrl}
                  </p>
                ) : null}
              </Card>
              <Card>
                <h2>Chat</h2>
                <div className="stack" style={{ marginTop: 12, maxHeight: 280, overflow: "auto" }}>
                  {(chat.data?.messages ?? []).map((item) => (
                    <p key={item.id}>
                      <strong>{item.authorId === user?.user.id ? "You" : "Member"}:</strong> {item.body}
                    </p>
                  ))}
                  {!chat.data?.messages.length ? <p className="lede">No messages yet.</p> : null}
                </div>
                <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void onChat(event)}>
                  <Field label="Message" htmlFor="chat">
                    <input id="chat" value={chatBody} onChange={(event) => setChatBody(event.target.value)} />
                  </Field>
                  <Button type="submit" disabled={busy !== null}>
                    Send
                  </Button>
                </form>
              </Card>
            </div>
          </>
        ) : null}
      </RequireAuth>
    </main>
  );
}
