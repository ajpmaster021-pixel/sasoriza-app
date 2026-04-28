import OpenAI from "openai";
import { NextRequest } from "next/server";

const ZODIAC_INFO: Record<string, { name: string; symbol: string }> = {
  aries:       { name: "おひつじ座", symbol: "♈" },
  taurus:      { name: "おうし座",   symbol: "♉" },
  gemini:      { name: "ふたご座",   symbol: "♊" },
  cancer:      { name: "かに座",     symbol: "♋" },
  leo:         { name: "しし座",     symbol: "♌" },
  virgo:       { name: "おとめ座",   symbol: "♍" },
  libra:       { name: "てんびん座", symbol: "♎" },
  scorpio:     { name: "さそり座",   symbol: "♏" },
  sagittarius: { name: "いて座",     symbol: "♐" },
  capricorn:   { name: "やぎ座",     symbol: "♑" },
  aquarius:    { name: "みずがめ座", symbol: "♒" },
  pisces:      { name: "うお座",     symbol: "♓" },
};

export async function POST(req: NextRequest) {
  try {
    const { sign, date, catchphrase, referenceImageB64 } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_openai_api_key_here") {
      return Response.json({ error: "OpenAIのAPIキーが設定されていません" }, { status: 500 });
    }

    const info = ZODIAC_INFO[sign];
    if (!info) {
      return Response.json({ error: "無効な星座です" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });

    const [year, month, day] = date.split("-");
    const dateJa = `${year}年${parseInt(month)}月${parseInt(day)}日`;

    // 参考画像がある場合はGPT-4oでスタイルを分析
    let styleDesc = "";
    if (referenceImageB64) {
      const vision = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${referenceImageB64}`, detail: "low" },
              },
              {
                type: "text",
                text: "This is a YouTube horoscope thumbnail. Describe its visual style in 2-3 sentences for use as a DALL-E prompt: color palette, atmosphere, layout, and any distinctive design elements. Be concise and specific.",
              },
            ],
          },
        ],
      });
      styleDesc = vision.choices[0]?.message?.content ?? "";
    }

    // DALL-E 3 プロンプト構築
    const baseStyle = styleDesc
      ? `Visual style (match this closely): ${styleDesc}`
      : "Dark mystical background with deep purple and indigo tones, scattered stars, ethereal glowing orbs, cinematic fantasy atmosphere.";

    const prompt = [
      `YouTube horoscope thumbnail for ${info.name} (${info.symbol}), ${dateJa}.`,
      baseStyle,
      `Prominently feature the zodiac symbol "${info.symbol}" and the Japanese text "${info.name}".`,
      catchphrase ? `Include this Japanese text prominently at the top: "${catchphrase}"` : "",
      `Include subtle Japanese text "ユリアの占い" at the bottom.`,
      "Wide 16:9 landscape composition. High contrast, visually striking, professional YouTube thumbnail quality. No people, no faces.",
    ].filter(Boolean).join(" ");

    const response = await client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      response_format: "b64_json",
    });

    const b64 = response.data[0]?.b64_json;
    if (!b64) {
      return Response.json({ error: "画像の生成に失敗しました" }, { status: 500 });
    }

    return Response.json({ imageB64: b64 });
  } catch (err: unknown) {
    console.error("Thumbnail error:", err);
    const msg = err instanceof Error ? err.message : "サムネイルの生成に失敗しました";
    return Response.json({ error: msg }, { status: 500 });
  }
}
