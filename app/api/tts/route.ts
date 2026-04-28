import { NextRequest } from "next/server";

// language_code をサポートするモデル
const LANG_CODE_SUPPORTED_MODELS = new Set([
  "eleven_v3",
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
  "eleven_turbo_v2",
]);

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      voiceId,
      speakingStyle,
      languageCode,
      modelId,
      stability,
      similarityBoost,
      styleExaggeration,
    } = await req.json();

    if (!text || typeof text !== "string") {
      return Response.json({ error: "テキストを指定してください" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey === "your_elevenlabs_key_here") {
      return Response.json({ error: "ElevenLabsのAPIキーが設定されていません" }, { status: 500 });
    }

    const voice = voiceId || "21m00Tcm4TlvDq8ikWAM";
    const model = modelId || "eleven_flash_v2_5";

    const styledText = speakingStyle
      ? `[${speakingStyle}]\n${text}`
      : text;

    // language_code は対応モデルのみ付与
    const langParam =
      languageCode && LANG_CODE_SUPPORTED_MODELS.has(model)
        ? { language_code: languageCode }
        : {};

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: styledText,
          model_id: model,
          ...langParam,
          voice_settings: {
            stability: stability ?? 0.75,
            similarity_boost: similarityBoost ?? 0.85,
            style: styleExaggeration ?? 0.05,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("ElevenLabs error:", res.status, errText);
      if (res.status === 401) {
        return Response.json({ error: "ElevenLabsのAPIキーが無効です" }, { status: 401 });
      }
      if (res.status === 422) {
        return Response.json({ error: "テキストが長すぎます（上限2500文字）" }, { status: 422 });
      }
      return Response.json({ error: `音声生成に失敗しました (${res.status})` }, { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return Response.json({ error: "音声生成に失敗しました" }, { status: 500 });
  }
}
