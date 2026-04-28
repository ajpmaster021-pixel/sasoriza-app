import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "edge";

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

// 日付から毎日変わる占い要素を導出する
function deriveDailyElements(year: number, month: number, day: number) {
  // 曜日
  const weekdays = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const weekday = weekdays[new Date(year, month - 1, day).getDay()];

  // 数秘術：月日の数字を全て足して1桁になるまで足す
  const sumDigits = (n: number): number => n < 10 ? n : sumDigits(Math.floor(n / 10) + (n % 10));
  const numerology = sumDigits(month + day);

  // 月の満ち欠け（2000年1月6日を新月基準に約29.53日周期で概算）
  const baseNewMoon = new Date(2000, 0, 6).getTime();
  const now = new Date(year, month - 1, day).getTime();
  const daysSince = (now - baseNewMoon) / 86400000;
  const moonAge = ((daysSince % 29.53) + 29.53) % 29.53;
  const moonPhase =
    moonAge < 1.5 ? "新月（新しい始まりの夜）" :
    moonAge < 7.4 ? "三日月〜上弦（エネルギーが満ちていく時期）" :
    moonAge < 14.8 ? "上弦〜満月直前（力が最高潮に近づく時）" :
    moonAge < 15.5 ? "満月（感情と直感が極限まで研ぎ澄まされる夜）" :
    moonAge < 22.1 ? "満月〜下弦（収穫と手放しの時期）" :
    moonAge < 28.0 ? "下弦〜新月直前（浄化と内省の時間）" :
    "晦日の月（次のサイクルへの準備期）";

  // 支配惑星（曜日ベース）
  const planets = ["太陽（日）", "月", "火星", "水星", "木星", "金星", "土星"];
  const rulingPlanet = planets[new Date(year, month - 1, day).getDay()];

  // テーマキーワード（日付の日×月を種にローテーション）
  const themes = [
    "覚醒と突破", "黄金の扉が開く", "秘密の暴露と解放", "運命的な出会い",
    "過去の清算と再生", "富と豊穣の流入", "魂の試練と飛躍", "隠れた才能の開花",
    "縁の結び直し", "宇宙からの緊急メッセージ", "奇跡の連鎖が始まる", "時代の転換点",
  ];
  const theme = themes[(day * month) % themes.length];

  // ラッキーカラー
  const colors = ["深紅", "紺碧", "黄金", "翡翠", "紫紺", "白銀", "漆黒", "珊瑚", "群青", "朱", "藤", "萌黄"];
  const luckyColor = colors[(day + month * 3) % colors.length];

  // ラッキーアイテム
  const items = [
    "水晶のアクセサリー", "新品の財布", "白い封筒", "金色のペン", "赤い糸",
    "鏡", "丸い石", "ハーブティー", "新しいノート", "香水", "花", "鍵",
  ];
  const luckyItem = items[(day + month * 7) % items.length];

  // 注意すべき時間帯
  const hours = ["午前3時台", "午前9時台", "正午前後", "午後2時台", "午後5時台", "夜9時台", "深夜0時台"];
  const luckyHour = hours[(day + month) % hours.length];

  return { weekday, numerology, moonPhase, rulingPlanet, theme, luckyColor, luckyItem, luckyHour };
}

function buildPrompt(signId: string, date: string, targetLength: number): string {
  const info = ZODIAC_INFO[signId];
  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);
  const dateJa = `${year}年${month}月${day}日`;

  const { weekday, numerology, moonPhase, rulingPlanet, theme, luckyColor, luckyItem, luckyHour } =
    deriveDailyElements(year, month, day);

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
4. 詳細な運勢（過去の努力が報われる・秘密が明かされる等）${targetLength >= 2000 ? "\n5. 金運と具体的なアドバイス（ラッキーアワーを必ず言及）" : ""}${targetLength >= 3000 ? "\n6. さらなる深読み・追加の運勢詳細" : ""}${targetLength >= 4000 ? "\n7. 人間関係・仕事運の詳細" : ""}
${targetLength >= 2000 ? (targetLength >= 3000 ? "8" : "6") : "5"}. 今日やるべき具体的な行動（ラッキーアイテムとラッキーカラーを必ず言及）
${targetLength >= 2000 ? (targetLength >= 3000 ? "9" : "7") : "6"}. CTAその1：コメント欄に特定の言葉を書くよう促す
${targetLength >= 2000 ? (targetLength >= 3000 ? "10" : "8") : "7"}. CTAその2：チャンネル登録を促す
${targetLength >= 2000 ? (targetLength >= 3000 ? "11" : "9") : "8"}. 締めの言葉（「いってらっしゃい」と「また明日」）

【今日（${dateJa}・${weekday}）固有の天体情報 ― これらを必ず台本に織り込むこと】
- 月の状態：${moonPhase}
- 支配惑星：${rulingPlanet}
- 今日の数秘：${numerology}（この数字を台本中に必ず登場させる）
- 今日のテーマ：「${theme}」（このテーマを中心に据えること）
- ラッキーカラー：${luckyColor}
- ラッキーアイテム：${luckyItem}
- 最強ラッキーアワー：${luckyHour}

【今回の設定】
- 星座：${info.name}
- 日付：${dateJa}（${weekday}）
- この星座の力：${info.power}
- シンボル：${info.symbol}
- 目標文字数：約${targetLength}字（必ずこの文字数に近い長さで書いてください）

重要：上記の天体情報はこの日付にしか当てはまりません。他の日と同じ内容にならないよう、今日固有の要素を全て台本に反映してください。

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
