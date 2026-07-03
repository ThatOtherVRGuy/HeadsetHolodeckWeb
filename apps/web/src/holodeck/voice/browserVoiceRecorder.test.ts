import { describe, expect, it, vi } from "vitest";
import { BrowserVoiceRecorder } from "./browserVoiceRecorder.js";

class FakeMediaRecorder extends EventTarget {
  state: RecordingState = "inactive";

  constructor(readonly stream: MediaStream) {
    super();
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    const event = new Event("dataavailable") as Event & { data: Blob };
    event.data = new Blob(["voice"], { type: "audio/webm" });
    this.dispatchEvent(event);
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }
}

class EmptyMediaRecorder extends EventTarget {
  state: RecordingState = "inactive";

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }
}

class FailingStartMediaRecorder extends EventTarget {
  state: RecordingState = "inactive";

  start(): void {
    throw new Error("MediaRecorder start failed");
  }

  stop(): void {
    this.state = "inactive";
  }
}

class FailingConstructorMediaRecorder extends EventTarget {
  state: RecordingState = "inactive";

  constructor() {
    super();
    throw new Error("MediaRecorder constructor failed");
  }
}

class AutoStopMediaRecorder extends EventTarget {
  static latest: AutoStopMediaRecorder | null = null;

  state: RecordingState = "inactive";

  constructor(readonly stream: MediaStream) {
    super();
    AutoStopMediaRecorder.latest = this;
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }
}

describe("BrowserVoiceRecorder", () => {
  it("records microphone audio into a blob and stops the stream tracks", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream)
      },
      mediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder
    });

    await recorder.start();
    expect(recorder.isRecording).toBe(true);

    const audio = await recorder.stop();

    expect(recorder.isRecording).toBe(false);
    expect(audio.size).toBe(5);
    expect(audio.type).toBe("audio/webm");
    expect(stop).toHaveBeenCalledOnce();
  });

  it("rejects duplicate starts", async () => {
    const stream = {
      getTracks: () => []
    } as unknown as MediaStream;
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream)
      },
      mediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder
    });

    await recorder.start();

    await expect(recorder.start()).rejects.toThrow(
      "Voice recording is already active"
    );
  });

  it("rejects duplicate starts while microphone permission is pending", async () => {
    let resolveStream: (stream: MediaStream) => void = () => {};
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    const stream = {
      getTracks: () => []
    } as unknown as MediaStream;
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn().mockReturnValue(pendingStream)
      },
      mediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder
    });

    const firstStart = recorder.start();

    await expect(recorder.start()).rejects.toThrow(
      "Voice recording is already starting"
    );

    resolveStream(stream);
    await firstStart;

    expect(recorder.isRecording).toBe(true);
  });

  it("rejects stops without captured audio", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream)
      },
      mediaRecorder: EmptyMediaRecorder as unknown as typeof MediaRecorder
    });

    await recorder.start();

    await expect(recorder.stop()).rejects.toThrow(
      "No microphone samples were captured"
    );
    expect(stop).toHaveBeenCalledOnce();
  });

  it("cancels an active recording without returning audio", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream)
      },
      mediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder
    });

    await recorder.start();
    await recorder.cancel();

    expect(recorder.isRecording).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
    await expect(recorder.stop()).rejects.toThrow(
      "Voice recording is not active"
    );
  });

  it("treats cancel without an active recording as a no-op", async () => {
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn()
      },
      mediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder
    });

    await expect(recorder.cancel()).resolves.toBeUndefined();
  });

  it("stops the stream if the recorder fails to start", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream)
      },
      mediaRecorder: FailingStartMediaRecorder as unknown as typeof MediaRecorder
    });

    await expect(recorder.start()).rejects.toThrow(
      "MediaRecorder start failed"
    );
    expect(recorder.isRecording).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("stops the stream if the recorder cannot be constructed", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream)
      },
      mediaRecorder:
        FailingConstructorMediaRecorder as unknown as typeof MediaRecorder
    });

    await expect(recorder.start()).rejects.toThrow(
      "MediaRecorder constructor failed"
    );
    expect(recorder.isRecording).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("cleans up when the recorder stops unexpectedly", async () => {
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce({
        getTracks: () => [{ stop: firstStop }]
      } as unknown as MediaStream)
      .mockResolvedValueOnce({
        getTracks: () => [{ stop: secondStop }]
      } as unknown as MediaStream);
    const recorder = new BrowserVoiceRecorder({
      mediaDevices: { getUserMedia },
      mediaRecorder: AutoStopMediaRecorder as unknown as typeof MediaRecorder
    });

    await recorder.start();
    AutoStopMediaRecorder.latest?.stop();

    expect(recorder.isRecording).toBe(false);
    expect(firstStop).toHaveBeenCalledOnce();

    await recorder.start();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(recorder.isRecording).toBe(true);
    expect(secondStop).not.toHaveBeenCalled();
  });
});
