"use client";

import { FormEvent, useState } from "react";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, Metric, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { money } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { PublicProduct, PublicTransaction } from "@/lib/ui-types";

type Earnings = {
  earnings: {
    grossRevenueCents: number;
    platformFeeCents: number;
    netCreatorAmountCents: number;
    succeededCount: number;
    currency: string;
    transactions: PublicTransaction[];
  };
};

export default function StudioMonetizationPage() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const products = useApi<{ products: PublicProduct[] }>(user ? "/api/v1/products" : null, tick);
  const earnings = useApi<Earnings>(user ? "/api/v1/creators/me/earnings" : null, tick);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("10");
  const [intervalDays, setIntervalDays] = useState("30");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    const next: Record<string, string> = {};
    if (!name.trim()) {
      next.name = "Name is required";
    }
    if (!Number.isFinite(cents) || cents < 100) {
      next.amount = "Minimum is 1.00";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch("/api/v1/products", {
        method: "POST",
        body: JSON.stringify({
          type: "MEMBERSHIP",
          name,
          amountCents: cents,
          currency: "USD",
          intervalDays: Number(intervalDays) || 30,
          status: "ACTIVE",
        }),
      });
      setName("");
      setOk(true);
      setMessage("Membership product created");
      setTick((value) => value + 1);
    } catch (error) {
      setOk(false);
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const data = earnings.data?.earnings;

  return (
    <>
      <PageHeader
        kicker="Studio"
        title="Monetization"
        lede="Membership products and verified earnings. Client-declared payment success is never trusted."
      />
      {data ? (
        <div className="metrics">
          <Metric label="Gross" value={money(data.grossRevenueCents, data.currency)} />
          <Metric label="Platform fee" value={money(data.platformFeeCents, data.currency)} />
          <Metric label="Net" value={money(data.netCreatorAmountCents, data.currency)} hint={`${data.succeededCount} succeeded`} />
        </div>
      ) : null}
      <div className="grid-cards two" style={{ marginTop: 16 }}>
        <Card>
          <h2>New membership</h2>
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void onCreate(event)} noValidate>
            <Field label="Name" htmlFor="name" error={errors.name}>
              <input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Price (USD)" htmlFor="amount" error={errors.amount}>
              <input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
            <Field label="Interval days" htmlFor="intervalDays">
              <input id="intervalDays" inputMode="numeric" value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>
              Create product
            </Button>
          </form>
          {message ? <StatusMessage tone={ok ? "ok" : "error"}>{message}</StatusMessage> : null}
        </Card>
        <div className="stack">
          {products.loading || earnings.loading ? <LoadingState label="Loading monetization" /> : null}
          {products.error ? <ErrorState message={products.error} onRetry={() => void products.reload()} /> : null}
          {!products.loading && !products.data?.products.length ? (
            <EmptyState title="No products" body="Create a membership so supporters can check out." />
          ) : (
            products.data?.products.map((product) => (
              <Card key={product.id} quiet>
                <div className="cluster">
                  <Badge>{product.status}</Badge>
                  <Badge>{product.type}</Badge>
                </div>
                <h3 style={{ marginTop: 8 }}>{product.name}</h3>
                <p className="lede">
                  {money(product.amountCents, product.currency)}
                  {product.intervalDays ? ` / ${product.intervalDays} days` : ""}
                </p>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
