interface BrowserVoiceRecorderOptions {
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  mediaRecorder?: typeof MediaRecorder;
}

export class BrowserVoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stopRequested = false;
  private isStarting = false;
  private readonly mediaDevices: Pick<MediaDevices, "getUserMedia">;
  private readonly mediaRecorder: typeof MediaRecorder;

  constructor(options: BrowserVoiceRecorderOptions = {}) {
    this.mediaDevices = options.mediaDevices ?? navigator.mediaDevices;
    this.mediaRecorder = options.mediaRecorder ?? MediaRecorder;
  }

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  async start(): Promise<void> {
    if (this.isStarting) {
      throw new Error("Voice recording is already starting");
    }

    if (this.isRecording) {
      throw new Error("Voice recording is already active");
    }

    this.isStarting = true;
    try {
      const stream = await this.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      this.chunks = [];

      const recorder = new this.mediaRecorder(stream);
      this.recorder = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        if (!this.stopRequested && this.recorder === recorder) {
          this.clearRecordingState({ clearChunks: true });
        }
      });

      recorder.addEventListener("error", () => {
        if (this.recorder === recorder) {
          this.clearRecordingState({ clearChunks: true });
        }
      });

      recorder.start();
      this.isStarting = false;
    } catch (error) {
      this.clearRecordingState({ clearChunks: true });
      throw error;
    }
  }

  async stop(): Promise<Blob> {
    if (!this.recorder || this.recorder.state !== "recording") {
      throw new Error("Voice recording is not active");
    }

    const recorder = this.recorder;

    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });

    this.stopRequested = true;
    recorder.stop();
    await stopped;
    this.stopRequested = false;

    this.clearRecordingState({ clearChunks: false });

    const type = this.chunks[0]?.type || "audio/webm";
    const audio = new Blob(this.chunks, { type });
    this.chunks = [];

    if (audio.size === 0) {
      throw new Error("No microphone samples were captured");
    }

    return audio;
  }

  async cancel(): Promise<void> {
    if (!this.recorder || this.recorder.state !== "recording") {
      return;
    }

    const recorder = this.recorder;
    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });

    this.stopRequested = true;
    recorder.stop();
    await stopped;
    this.clearRecordingState({ clearChunks: true });
  }

  private clearRecordingState(options: { clearChunks: boolean }): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.stopRequested = false;
    this.isStarting = false;

    if (options.clearChunks) {
      this.chunks = [];
    }
  }
}
