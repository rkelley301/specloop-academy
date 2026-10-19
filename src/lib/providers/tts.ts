// Text-to-speech provider boundary.
//
// SpecLoop doesn't know OneStudio's API. No endpoint, SDK, auth method or
// feature has been verified, so nothing here guesses at one. The working path
// is manual: copy the audio-ready script, generate audio in OneStudio
// yourself, and upload the MP3/WAV. A verified direct integration can be added
// by implementing TtsProvider.generate() (see docs/onestudio-integration.md).

export interface TtsStatus {
  available: boolean;
  reason: string;
}

export interface TtsProvider {
  id: "manual_upload" | "onestudio";
  label: string;
  status(config: { onestudioConfigured: boolean }): TtsStatus;
  /** Returns generated audio. Only implemented by direct-generation providers. */
  generate?(input: { lessonId: string; script: string; scriptVersion: number }): Promise<Blob>;
}

export const manualUploadProvider: TtsProvider = {
  id: "manual_upload",
  label: "Manual upload (OneStudio or any recorder)",
  status: () => ({
    available: true,
    reason: "Copy the script, produce audio in OneStudio, then upload the MP3 or WAV here.",
  }),
};

export const oneStudioProvider: TtsProvider = {
  id: "onestudio",
  label: "OneStudio direct generation",
  status: () => ({
    available: false,
    reason:
      "Not available. No verified OneStudio API documentation or credentials are configured in this build, so SpecLoop won't guess at one. Use manual upload.",
  }),
};

export const TTS_PROVIDERS: TtsProvider[] = [manualUploadProvider, oneStudioProvider];

export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"]);

export function validateAudioFile(file: { name: string; type: string; size: number }): string | null {
  const ext = file.name.toLowerCase().split(".").pop();
  const typeOk = AUDIO_TYPES.has(file.type) || ((file.type === "" || file.type === "application/octet-stream") && (ext === "mp3" || ext === "wav"));
  if (!typeOk || (ext !== "mp3" && ext !== "wav")) return "Choose an MP3 or WAV file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > AUDIO_MAX_BYTES) return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 50 MB.`;
  return null;
}

export function normalizedAudioType(file: { name: string; type: string }): string {
  if (AUDIO_TYPES.has(file.type)) return file.type === "audio/mp3" ? "audio/mpeg" : file.type;
  return file.name.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/mpeg";
}
