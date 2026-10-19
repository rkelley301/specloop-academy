# OneStudio audio: current workflow and what direct generation needs

## What works today

SpecLoop doesn't call OneStudio. No OneStudio API, SDK, endpoint, authentication
method or feature was documented in this repository or configured in the
environment, so nothing was guessed. The supported workflow is manual:

1. **Audio studio → Copy script** (or **Download .txt**). The text is the lesson
   title plus the narration script. Pause cues stay as editable text, e.g.
   `[PAUSE 3 SECONDS]` or `[PAUSE 5s: Name the parts before I list them.]`.
2. Produce the narration in OneStudio, turning cues into silences or adjusting
   them however you like, and export **MP3 or WAV** (≤ 50 MB).
3. **Audio studio → Upload**. The file is attached to the lesson, previewed in the
   browser player, and can be replaced or removed. Each upload records the
   script version it was made from. If the script is edited later, the lesson
   player flags that the audio may no longer match.

When a lesson has no audio, the player shows a transcript-first notice instead of
an empty `<audio>` element.

## Where direct generation plugs in

`src/lib/providers/tts.ts` defines the `TtsProvider` interface:

```ts
interface TtsProvider {
  id: "manual_upload" | "onestudio";
  status(config): { available: boolean; reason: string };
  generate?(input: { lessonId: string; script: string; scriptVersion: number }): Promise<Blob>;
}
```

`oneStudioProvider` is a stub that always reports *not available*. A real
adapter would implement `generate()` server side (in a route handler, so the
API key never reaches the browser), return the audio, and store it with
`provider: "onestudio"` through the same path as manual uploads.
`.env.example` reserves `ONESTUDIO_API_BASE_URL` and `ONESTUDIO_API_KEY`, but
nothing reads them yet.

## Information needed to enable it

Please provide, from OneStudio's official documentation or account settings:

- [ ] Whether OneStudio offers a public or partner **API** for text-to-speech at all, and your plan's access to it
- [ ] **Base URL** and the endpoint(s) for creating speech from text
- [ ] **Authentication**: API key, OAuth, or other; header names; key scopes; how keys are issued and rotated
- [ ] **Request format**: voice/model selection, max text length per request, and how to express pauses (SSML `<break>`, a proprietary tag, or none)
- [ ] **Response format**: synchronous audio bytes vs. an async job with polling or webhook; output formats (MP3/WAV), sample rate
- [ ] **Limits and cost**: rate limits, character quotas, pricing per character or minute
- [ ] **Terms**: whether generated audio may be stored and redistributed in a training product; data retention for submitted text
- [ ] A test key or sandbox for verification

With those details the adapter is a small, isolated change: a route handler plus
`generate()`, a cue converter (for example `[PAUSE 3 SECONDS]` → `<break time="3s"/>`
if SSML is supported), and a status check driven by configured environment variables.
