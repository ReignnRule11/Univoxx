"use client";

import { FormEvent, useState } from "react";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/hooks/use-api";
import type { PublicCommunity, PublicOrganization } from "@/lib/ui-types";

export default function StudioCommunityPage() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const orgs = useApi<{ organizations: PublicOrganization[] }>(user ? "/api/v1/organizations" : null);
  const communities = useApi<{ communities: PublicCommunity[] }>(user ? "/api/v1/communities" : null, tick);
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [channelCommunityId, setChannelCommunityId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelSlug, setChannelSlug] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function createOrg(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (orgName.trim().length < 2) {
      next.orgName = "Organization name must be at least 2 characters";
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(orgSlug.trim().toLowerCase())) {
      next.orgSlug = "Use 3-32 lowercase letters, numbers, and hyphens";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name: orgName, slug: orgSlug.trim().toLowerCase() }),
      });
      setOrgName("");
      setOrgSlug("");
      setOk(true);
      setMessage("Organization created");
      await orgs.reload();
    } catch (error) {
      setOk(false);
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createCommunity(event: FormEvent) {
    event.preventDefault();
    const org = organizationId || orgs.data?.organizations[0]?.id || "";
    const next: Record<string, string> = {};
    if (!org) {
      next.organizationId = "Create an organization first";
    }
    if (name.trim().length < 2) {
      next.name = "Name must be at least 2 characters";
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(slug.trim().toLowerCase())) {
      next.slug = "Use 3-32 lowercase letters, numbers, and hyphens";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch("/api/v1/communities", {
        method: "POST",
        body: JSON.stringify({
          organizationId: org,
          name,
          slug: slug.trim().toLowerCase(),
          description: description || undefined,
          visibility: "PUBLIC",
        }),
      });
      setName("");
      setSlug("");
      setDescription("");
      setOk(true);
      setMessage("Community created");
      setTick((value) => value + 1);
    } catch (error) {
      setOk(false);
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createChannel(event: FormEvent) {
    event.preventDefault();
    const community = channelCommunityId || communities.data?.communities[0]?.id || "";
    const next: Record<string, string> = {};
    if (!community) {
      next.channelCommunityId = "Create a community first";
    }
    if (channelName.trim().length < 2) {
      next.channelName = "Channel name must be at least 2 characters";
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(channelSlug.trim().toLowerCase())) {
      next.channelSlug = "Use 3-32 lowercase letters, numbers, and hyphens";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/communities/${community}/channels`, {
        method: "POST",
        body: JSON.stringify({
          name: channelName,
          slug: channelSlug.trim().toLowerCase(),
          visibility: "OPEN",
        }),
      });
      setChannelName("");
      setChannelSlug("");
      setOk(true);
      setMessage("Channel created");
    } catch (error) {
      setOk(false);
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Studio" title="Community" lede="Organizations own communities. Creating a community requires an ADMIN role in that organization." />
      <div className="grid-cards two">
        <Card>
          <h2>Organization</h2>
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void createOrg(event)} noValidate>
            <Field label="Name" htmlFor="orgName" error={errors.orgName}>
              <input id="orgName" value={orgName} onChange={(event) => setOrgName(event.target.value)} />
            </Field>
            <Field label="Slug" htmlFor="orgSlug" error={errors.orgSlug}>
              <input id="orgSlug" value={orgSlug} onChange={(event) => setOrgSlug(event.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>
              Create organization
            </Button>
          </form>
        </Card>
        <Card>
          <h2>New community</h2>
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void createCommunity(event)} noValidate>
            <Field label="Organization" htmlFor="organizationId" error={errors.organizationId}>
              <select
                id="organizationId"
                value={organizationId || orgs.data?.organizations[0]?.id || ""}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {(orgs.data?.organizations ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.role})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name" htmlFor="name" error={errors.name}>
              <input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Slug" htmlFor="slug" error={errors.slug}>
              <input id="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
            </Field>
            <Field label="Description" htmlFor="description">
              <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>
              Create community
            </Button>
          </form>
        </Card>
      </div>
      <Card style={{ marginTop: 16 }}>
        <h2>New channel</h2>
        <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void createChannel(event)} noValidate>
          <Field label="Community" htmlFor="channelCommunityId" error={errors.channelCommunityId}>
            <select
              id="channelCommunityId"
              value={channelCommunityId || communities.data?.communities[0]?.id || ""}
              onChange={(event) => setChannelCommunityId(event.target.value)}
            >
              {(communities.data?.communities ?? []).map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name" htmlFor="channelName" error={errors.channelName}>
            <input id="channelName" value={channelName} onChange={(event) => setChannelName(event.target.value)} />
          </Field>
          <Field label="Slug" htmlFor="channelSlug" error={errors.channelSlug}>
            <input id="channelSlug" value={channelSlug} onChange={(event) => setChannelSlug(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>
            Create channel
          </Button>
        </form>
      </Card>
      {message ? <StatusMessage tone={ok ? "ok" : "error"}>{message}</StatusMessage> : null}
      {communities.loading ? <LoadingState label="Loading communities" /> : null}
      {communities.error ? <ErrorState message={communities.error} onRetry={() => void communities.reload()} /> : null}
      {!communities.loading && !communities.data?.communities.length ? (
        <EmptyState title="No communities" body="Create an organization, then a community." />
      ) : (
        <div className="stack" style={{ marginTop: 16 }}>
          {communities.data?.communities.map((community) => (
            <Card key={community.id} quiet>
              <div className="cluster">
                <Badge>{community.visibility}</Badge>
                {community.membership ? <Badge>{community.membership.role}</Badge> : null}
              </div>
              <h3 style={{ marginTop: 8 }}>{community.name}</h3>
              <p className="lede">{community.description || "No description"}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
