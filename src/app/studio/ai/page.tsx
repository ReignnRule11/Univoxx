"use client";

import { FormEvent, useState } from "react";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/hooks/use-api";

type Job = {
  id: string;
  kind: string;
  status: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
};

type Usage = { kind: string; jobs: number; inputTokens: number; outputTokens: number };

export default function StudioAiPage() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const jobs = useApi<{ jobs: Job[] }>(user ? "/api/v1/ai" : null, tick);
  const usage = useApi<{ usage: Usage[] }>(user ? "/api/v1/ai/usage" : null, tick);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("How am I doing?");
  const [output, setOutput] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: "captions" | "repurpose" | "explain", event: FormEvent) {
    event.preventDefault();
    setBusy(kind);
    setMessage(null);
    setOutput(null);
    try {
      if (kind === "explain") {
        const result = await apiFetch<{ output: string }>("/api/v1/ai/analytics/explain", {
          method: "POST",
          body: JSON.stringify({ question }),
        });
        setOutput(result.output);
      } else if (kind === "captions") {
        const result = await apiFetch<{ output: string }>("/api/v1/ai/captions", {
          method: "POST",
          body: JSON.stringify({ text }),
        });
        setOutput(result.output);
      } else {
        const result = await apiFetch<{ output: string }>("/api/v1/ai/repurpose", {
          method: "POST",
          body: JSON.stringify({ text, format: "thread" }),
        });
        setOutput(result.output);
      }
      setOk(true);
      setMessage("Generation complete");
      setTick((value) => value + 1);
    } catch (error) {
      setOk(false);
      setMessage(errorMessage(error, "AI is unavailable until a provider is configured"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Studio"
        title="AI"
        lede="Captions, repurposing, and analytics explanations. Missing credentials fail closed. AI cannot move money or change ownership."
      />
      <div className="grid-cards two">
        <Card>
          <h2>Generate</h2>
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void run("captions", event)}>
            <Field label="Source text" htmlFor="text">
              <textarea id="text" value={text} onChange={(event) => setText(event.target.value)} />
            </Field>
            <div className="cluster">
              <Button type="submit" disabled={busy !== null}>
                {busy === "captions" ? "Working" : "Captions"}
              </Button>
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={(event) => void run("repurpose", event)}>
                Repurpose
              </Button>
            </div>
          </form>
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void run("explain", event)}>
            <Field label="Ask about your verified analytics" htmlFor="question">
              <input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              Explain snapshot
            </Button>
          </form>
          {message ? <StatusMessage tone={ok ? "ok" : "error"}>{message}</StatusMessage> : null}
          {output ? <p className="lede" style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{output}</p> : null}
        </Card>
        <div className="stack">
          {jobs.loading ? <LoadingState label="Loading AI jobs" /> : null}
          {jobs.error ? <ErrorState message={jobs.error} onRetry={() => void jobs.reload()} /> : null}
          {(usage.data?.usage ?? []).map((row) => (
            <Card key={row.kind} quiet>
              <p className="page-kicker">{row.kind}</p>
              <p className="lede">
                {row.jobs} jobs · {row.inputTokens} in · {row.outputTokens} out
              </p>
            </Card>
          ))}
          {!jobs.loading && !jobs.data?.jobs.length ? (
            <EmptyState title="No jobs yet" body="Run a generation after a language model is configured." />
          ) : (
            jobs.data?.jobs.map((job) => (
              <Card key={job.id} quiet>
                <div className="cluster">
                  <Badge>{job.kind}</Badge>
                  <Badge tone={job.status === "SUCCEEDED" ? "success" : job.status === "FAILED" ? "danger" : undefined}>
                    {job.status}
                  </Badge>
                </div>
                <p className="lede" style={{ marginTop: 8 }}>
                  {job.provider ?? "unconfigured"} {job.model ?? ""}
                </p>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
