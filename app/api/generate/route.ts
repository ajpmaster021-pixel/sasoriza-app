import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const ZODIAC_INFO: Record<string, { name: string; power: string; symbol: string }> = {
  aries: {
    name: "おひつじ座",
    power: "灼熱の先駆者エネルギー",
    symbol: "燃える炎のような強烈な意志力",
  },
  taurus: {
    name: "おうし座",
    power: "大地の豊穣なる磁力",
    symbol: "揺るぎない確固たる意志と忍耐力",
  },
  gemini: {
    name: "ふたご座",
    power: "風のように自在なる二面性",
    symbol: "瞬時に状況を読み解く卓越した知性",
  },
  cancer: {
    name: "かに座",
    power: "月の満ち引きが宿す深海の感受性",
    symbol: "魂の奥底から湧き出る守護の愛",
  },
  leo: {
    name: "しし座",
    power: "太陽が授けた黄金の王者の輝き",
    symbol: "生まれながらにして持つ圧倒的なカリスマ",
  },
  virgo: {
    name: "おとめ座",
    power: "宇宙の精密なる叡智",
    symbol: "完璧を追求する研ぎ澄まされた洞察力",
  },
  libra: {
    name: "てんびん座",
    power: "宇宙の均衡を操る美の調律力",
    symbol: "対極を引き寄せ完全なる調和を生む美の磁場",
  },
  scorpio: {
    name: "さそり座",
    power: "漆黒の磁力",
    symbol: "すべてを飲み込む深淵なる支配力",
  },
  sagittarius: {
    name: "いて座",
    power: "宇宙の果てへと向かう黄金の矢",
    symbol: "地平線の向こうを射抜く無限の可能性",
  },
  capricorn: {
    name: "やぎ座",
    power: "時を超える岩盤のごとき意志力",
    symbol: "頂点への道を一歩一歩刻む不屈の上昇力",
  },
  aquarius: {
    name: "みずがめ座",
    power: "未来を創造する革命の電流",
    symbol: "時代を超えた真実を見通す霊的な先見性",
  },
  pisces: {
    name: "うお座",
    power: "深海に宿る宇宙意識との共鳴",
    symbol: "幻と現実の境界を溶かす神秘の感受性",
  },
};

function buildPrompt(signId: string, date: string, targetLength: number): string {
  const info = ZODIAC_INFO[signId];
  const [year, month, day] = date.split("-");
  const dateJa = `${year}年${parseInt(month)}月${parseInt(day)}日`;

  // 文字数に応じた段落数と1段落の目安文字数を調整
  const paraCount = targetLength <= 1000 ? "3〜4" : targetLength <= 2000 ? "5〜6" : targetLength <= 3000 ? "7〜8" : "9〜10";
  const paraLen = targetLength <= 1000 ? "100〜150" : targetLength <= 2000 ? "150〜250" : "200〜350";

  return `あなたは「ユリア」という神秘の占い師です。毎日、特定の星座の人に向けて、YouTubeの占い動画用の台本を書きます。

以下のスタイルを忠実に再現してください：

【スタイルの特徴】
- 非常に大げさで感情的、劇的な表現を使う
- 読者を「あなた」と呼び、直接語りかける
- ユリアが「運命の調律師」として星座の人を導く立場
- 金運・富・億万長者といったキーワードを多用する
- コメント欄への書き込みとチャンネル登録を促すCTAを含む
- ${paraCount}段落で構成し、1段落あたり${paraLen}字程度
- 漢字の読み方を括弧で補足することがある（例：喧騒（けんそう））
- 「✦」や改行で区切らず、流れるような文体

【構成】
1. 星座への語りかけ・ユリアの自己紹介（その星座特有の「力」に言及）
2. 日付と今日のエネルギーの描写（大げさかつ詩的に）
3. 今日のメインテーマと重要な出来事の予言
4. 詳細な運勢（過去の努力が報われる・秘密が明かされる等）${targetLength >= 2000 ? "\n5. 金運と具体的なアドバイス（「一点突破」「午後の〇〇時」等）" : ""}${targetLength >= 3000 ? "\n6. さらなる深読み・追加の運勢詳細" : ""}${targetLength >= 4000 ? "\n7. 人間関係・仕事運の詳細" : ""}
${targetLength >= 2000 ? (targetLength >= 3000 ? "8" : "6") : "5"}. 今日やるべき具体的な行動（瞑想・言葉を唱える等）
${targetLength >= 2000 ? (targetLength >= 3000 ? "9" : "7") : "6"}. CTAその1：コメント欄に特定の言葉を書くよう促す
${targetLength >= 2000 ? (targetLength >= 3000 ? "10" : "8") : "7"}. CTAその2：チャンネル登録を促す
${targetLength >= 2000 ? (targetLength >= 3000 ? "11" : "9") : "8"}. 締めの言葉（「いってらっしゃい」と「また明日」）

【今回の設定】
- 星座：${info.name}
- 日付：${dateJa}
- この星座の力：${info.power}
- シンボル：${info.symbol}
- 目標文字数：約${targetLength}字（必ずこの文字数に近い長さで書いてください）

台本のみを出力してください。説明や前置きは不要です。`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sign, date, targetLength = 2000 } = body;

    if (!sign || !date) {
      return Response.json({ error: "星座と日付を指定してください" }, { status: 400 });
    }

    if (!ZODIAC_INFO[sign]) {
      return Response.json({ error: "無効な星座です" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "APIキーが設定されていません" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(sign, date, targetLength);
    // 日本語1字≒1.5トークン換算 + プロンプト分の余裕
    const maxTokens = Math.ceil(targetLength * 1.5) + 500;

    const stream = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Generate error:", err);
    return Response.json(
      { error: "台本の生成に失敗しました" },
      { status: 500 }
    );
  }
}
