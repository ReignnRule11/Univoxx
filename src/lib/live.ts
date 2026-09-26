import { getConfig } from "./config";
import { serviceUnavailable } from "./errors";

export const LIVE_PROVIDERS = ["local", "daily", "livekit"] as const;
export type LiveProviderName = (typeof LIVE_PROVIDERS)[number];

export type LiveRoom = {
  provider: LiveProviderName;
  roomId: string;
  joinUrl: string;
  hostToken: string;
  attendeeToken: string;
  recordingSupported: boolean;
};

export type LiveRecordingResult = {
  available: boolean;
  providerRef?: string;
  reason?: string;
};

export type LiveRoomProvider = {
  name: LiveProviderName;
  createRoom(input: { eventId: string; title: string }): Promise<LiveRoom>;
  closeRoom(roomId: string): Promise<void>;
  requestRecording(roomId: string): Promise<LiveRecordingResult>;
};

export class LocalLiveRoomProvider implements LiveRoomProvider {
  readonly name = "local" as const;
  private readonly rooms = new Set<string>();

  async createRoom(input: { eventId: string; title: string }): Promise<LiveRoom> {
    const roomId = `local_${input.eventId}`;
    this.rooms.add(roomId);
    return {
      provider: this.name,
      roomId,
      joinUrl: `/live/${roomId}`,
      hostToken: `host_${roomId}`,
      attendeeToken: `attendee_${roomId}`,
      recordingSupported: false,
    };
  }

  async closeRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }

  async requestRecording(): Promise<LiveRecordingResult> {
    return { available: false, reason: "Local live rooms do not produce recordings" };
  }
}

function configuredLiveProvider(): LiveProviderName | undefined {
  const config = getConfig();
  if (config.LIVE_PROVIDER) {
    return config.LIVE_PROVIDER;
  }
  return config.NODE_ENV === "production" ? undefined : "local";
}

export function createLiveRoomProvider(): LiveRoomProvider {
  const config = getConfig();
  const name = configuredLiveProvider();
  if (!name) {
    throw serviceUnavailable("Live room provider is not configured");
  }
  if (name === "local") {
    if (config.NODE_ENV === "production") {
      throw serviceUnavailable("Local live rooms are not allowed in production");
    }
    return new LocalLiveRoomProvider();
  }
  throw serviceUnavailable(`${name} live rooms require credentials that are not configured`);
}

let activeProvider: LiveRoomProvider | undefined;

export function getLiveRoomProvider(): LiveRoomProvider {
  if (!activeProvider) {
    activeProvider = createLiveRoomProvider();
  }
  return activeProvider;
}

export function setLiveRoomProvider(provider: LiveRoomProvider): void {
  activeProvider = provider;
}

export function resetLiveRoomProvider(): void {
  activeProvider = undefined;
}
