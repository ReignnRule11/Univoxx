import { createHash, createHmac } from "node:crypto";
import { getConfig } from "./config";
import { serviceUnavailable } from "./errors";

export type StoredObject = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type StorageProvider = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
};

export class MemoryStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, StoredObject>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { key, body: Buffer.from(body), contentType });
  }

  async get(key: string): Promise<StoredObject | null> {
    const current = this.objects.get(key);
    if (!current) {
      return null;
    }
    return { key: current.key, body: Buffer.from(current.body), contentType: current.contentType };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

type S3Config = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

export class S3StorageProvider implements StorageProvider {
  constructor(private readonly config: S3Config) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const response = await this.request("PUT", key, body, contentType);
    if (!response.ok) {
      throw serviceUnavailable("Object storage is unavailable");
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    const response = await this.request("GET", key);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw serviceUnavailable("Object storage is unavailable");
    }
    return {
      key,
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  async delete(key: string): Promise<void> {
    const response = await this.request("DELETE", key);
    if (!response.ok && response.status !== 404) {
      throw serviceUnavailable("Object storage is unavailable");
    }
  }

  private async request(method: string, key: string, body?: Buffer, contentType?: string): Promise<Response> {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const host = this.host();
    const path = this.config.forcePathStyle ? `/${this.config.bucket}/${encodedKey}` : `/${encodedKey}`;
    const url = `${this.baseUrl()}${path}`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(body ?? "");
    const headerContentType = contentType ?? "application/octet-stream";
    const canonicalHeaders = [
      `content-type:${headerContentType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join("\n");
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [method, path, "", `${canonicalHeaders}\n`, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
    const signature = hmac(this.signingKey(dateStamp), stringToSign).toString("hex");
    const headers: Record<string, string> = {
      host,
      "content-type": headerContentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (body) {
      headers["content-length"] = String(body.length);
    }
    try {
      return await fetch(url, {
        method,
        headers,
        body: body ? new Uint8Array(body) : undefined,
      });
    } catch {
      throw serviceUnavailable("Object storage is unavailable");
    }
  }

  private signingKey(dateStamp: string): Buffer {
    const kDate = hmac(`AWS4${this.config.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.config.region);
    const kService = hmac(kRegion, "s3");
    return hmac(kService, "aws4_request");
  }

  private host(): string {
    if (this.config.endpoint) {
      return new URL(this.config.endpoint).host;
    }
    if (this.config.forcePathStyle) {
      return `s3.${this.config.region}.amazonaws.com`;
    }
    return `${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
  }

  private baseUrl(): string {
    if (this.config.endpoint) {
      return this.config.endpoint.replace(/\/$/, "");
    }
    if (this.config.forcePathStyle) {
      return `https://s3.${this.config.region}.amazonaws.com`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
  }
}

let activeProvider: StorageProvider | undefined;

export function createStorageProvider(): StorageProvider {
  const config = getConfig();
  const provider = config.STORAGE_PROVIDER ?? (config.NODE_ENV === "production" ? "s3" : "memory");
  if (provider === "memory") {
    return new MemoryStorageProvider();
  }
  return new S3StorageProvider({
    endpoint: config.S3_ENDPOINT || undefined,
    region: config.S3_REGION ?? "us-east-1",
    bucket: config.S3_BUCKET ?? "",
    accessKeyId: config.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: config.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
  });
}

export function getStorageProvider(): StorageProvider {
  if (!activeProvider) {
    activeProvider = createStorageProvider();
  }
  return activeProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  activeProvider = provider;
}

export function resetStorageProvider(): void {
  activeProvider = undefined;
}

export function checksumSha256(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}
