"use client";

import { useState, useRef, useEffect } from "react";

const ZODIAC_SIGNS = [
  { id: "aries", name: "おひつじ座", emoji: "♈" },
  { id: "taurus", name: "おうし座", emoji: "♉" },
  { id: "gemini", name: "ふたご座", emoji: "♊" },
  { id: "cancer", name: "かに座", emoji: "♋" },
  { id: "leo", name: "しし座", emoji: "♌" },
  { id: "virgo", name: "おとめ座", emoji: "♍" },
  { id: "libra", name: "てんびん座", emoji: "♎" },
  { id: "scorpio", name: "さそり座", emoji: "♏" },
  { id: "sagittarius", name: "いて座", emoji: "♐" },
  { id: "capricorn", name: "やぎ座", emoji: "♑" },
  { id: "aquarius", name: "みずがめ座", emoji: "♒" },
  { id: "pisces", name: "うお座", emoji: "♓" },
];

type SavedVoice = { id: string; name: string; voiceId: string };

const VOICES_KEY = "yuria_saved_voices";

function loadVoices(): SavedVoice[] {
  try {
    return JSON.parse(localStorage.getItem(VOICES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveVoices(voices: SavedVoice[]) {
  localStorage.setItem(VOICES_KEY, JSON.stringify(voices));
}

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const LENGTH_OPTIONS = [
  { value: 1000, label: "約1000字", desc: "短め" },
  { value: 2000, label: "約2000字", desc: "標準" },
  { value: 3000, label: "約3000字", desc: "長め" },
  { value: 4000, label: "約4000字", desc: "詳細" },
];

export default function Home() {
  const [selectedSign, setSelectedSign] = useState("scorpio");
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [targetLength, setTargetLength] = useState(2000);
  const [script, setScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [copied, setCopied] = useState(false);

  // ボイス管理
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceId, setNewVoiceId] = useState("");
  const [voiceSaveError, setVoiceSaveError] = useState("");

  // 音声生成
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState("");
  const [customStyle, setCustomStyle] = useState("");
  const [langOverride, setLangOverride] = useState(true);
  const [languageCode, setLanguageCode] = useState("ja");
  const [modelId, setModelId] = useState("eleven_v3");
  const [stability, setStability] = useState(0.75);
  const [similarityBoost, setSimilarityBoost] = useState(0.85);
  const [styleExaggeration, setStyleExaggeration] = useState(0.05);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [thumbnailTitle, setThumbnailTitle] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState("");

  useEffect(() => {
    const voices = loadVoices();
    setSavedVoices(voices);
    if (voices.length > 0) setSelectedVoiceId(voices[0].id);
  }, []);

  const sign = ZODIAC_SIGNS.find((z) => z.id === selectedSign)!;

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${y}年${parseInt(m)}月${parseInt(d)}日`;
  };

  // ---- 台本生成 ----
  async function handleGenerate() {
    setIsGenerating(true);
    setGenerateError("");
    setScript("");
    setAudioUrl("");
    setAudioError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign: selectedSign, date: selectedDate, targetLength }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "生成に失敗しました");
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setScript(result);
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  }

  // ---- テキスト分割（2000字以内のチャンクに） ----
  function splitText(text: string, maxLen = 2000): string[] {
    // まず段落（空行）で分割
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let current = "";

    for (const para of paragraphs) {
      const separator = current ? "\n\n" : "";
      if ((current + separator + para).length <= maxLen) {
        current += separator + para;
      } else {
        // 現在のチャンクを確定
        if (current) chunks.push(current);
        // 段落自体が2000字超なら句点で分割
        if (para.length > maxLen) {
          const sentences = para.split(/(?<=。|！|？|\n)/);
          current = "";
          for (const s of sentences) {
            if ((current + s).length <= maxLen) {
              current += s;
            } else {
              if (current) chunks.push(current);
              // 文自体が超長い場合は強制分割
              if (s.length > maxLen) {
                for (let i = 0; i < s.length; i += maxLen) {
                  chunks.push(s.slice(i, i + maxLen));
                }
                current = "";
              } else {
                current = s;
              }
            }
          }
        } else {
          current = para;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.filter((c) => c.trim());
  }

  // ---- ボイス保存 ----
  function handleSaveVoice() {
    setVoiceSaveError("");
    const name = newVoiceName.trim();
    const voiceId = newVoiceId.trim();
    if (!name) { setVoiceSaveError("名前を入力してください"); return; }
    if (!voiceId) { setVoiceSaveError("Voice IDを入力してください"); return; }
    if (savedVoices.some((v) => v.voiceId === voiceId)) {
      setVoiceSaveError("このVoice IDはすでに登録されています");
      return;
    }
    const newVoice: SavedVoice = {
      id: crypto.randomUUID(),
      name,
      voiceId,
    };
    const updated = [...savedVoices, newVoice];
    setSavedVoices(updated);
    saveVoices(updated);
    setSelectedVoiceId(newVoice.id);
    setNewVoiceName("");
    setNewVoiceId("");
  }

  function handleDeleteVoice(id: string) {
    const updated = savedVoices.filter((v) => v.id !== id);
    setSavedVoices(updated);
    saveVoices(updated);
    if (selectedVoiceId === id) {
      setSelectedVoiceId(updated.length > 0 ? updated[0].id : "");
    }
  }

  // ---- 音声生成（分割対応） ----
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });

  async function handleGenerateAudio() {
    if (!script) return;
    const voice = savedVoices.find((v) => v.id === selectedVoiceId);
    if (!voice) { setAudioError("ボイスを選択してください"); return; }

    setIsGeneratingAudio(true);
    setAudioError("");
    setAudioUrl("");

    try {
      const chunks = splitText(script, 2000);
      setAudioProgress({ current: 0, total: chunks.length });

      const buffers: ArrayBuffer[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setAudioProgress({ current: i + 1, total: chunks.length });
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              text: chunks[i],
              voiceId: voice.voiceId,
              speakingStyle: customStyle.trim() || speakingStyle || undefined,
              languageCode: langOverride ? languageCode : undefined,
              modelId,
              stability,
              similarityBoost,
              styleExaggeration,
            }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "音声生成に失敗しました");
        }
        buffers.push(await res.arrayBuffer());
      }

      // 全バッファを結合して1つのMP3 Blobに
      const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const buf of buffers) {
        merged.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      }

      const url = URL.createObjectURL(new Blob([merged], { type: "audio/mpeg" }));
      setAudioUrl(url);
      setTimeout(() => audioRef.current?.play(), 100);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "音声生成に失敗しました");
    } finally {
      setIsGeneratingAudio(false);
      setAudioProgress({ current: 0, total: 0 });
    }
  }

  // ---- サムネイル生成（DALL-E 3） ----
  async function generateThumbnail() {
    setIsGeneratingThumbnail(true);
    setThumbnailError("");
    setThumbnailUrl(null);

    try {
      // data:image/...;base64, のプレフィックスを除去
      const referenceImageB64 = referenceImage
        ? referenceImage.replace(/^data:image\/[^;]+;base64,/, "")
        : undefined;

      const res = await fetch("/api/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sign: selectedSign,
          date: selectedDate,
          catchphrase: thumbnailTitle.trim() || undefined,
          referenceImageB64,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");

      setThumbnailUrl(`data:image/png;base64,${data.imageB64}`);
    } catch (err) {
      setThumbnailError(err instanceof Error ? err.message : "サムネイルの生成に失敗しました");
    } finally {
      setIsGeneratingThumbnail(false);
    }
  }

  function handleDownloadThumbnail() {
    if (!thumbnailUrl) return;
    const a = document.createElement("a");
    a.href = thumbnailUrl;
    a.download = `${sign.name}_${selectedDate}_thumbnail.png`;
    a.click();
  }

  async function handleCopy() {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadAudio() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${sign.name}_${selectedDate}.mp3`;
    a.click();
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-purple-900/50 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🔮</span>
          <div>
            <h1 className="text-xl font-bold text-purple-300 leading-none">ユリアの占い台本生成</h1>
            <p className="text-xs text-gray-500 mt-0.5">星々の囁きを言葉と音声に変える</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* 台本生成パネル */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">📅 占いの日付</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:border-purple-500 w-full max-w-xs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-300 mb-3">✨ 星座を選択</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {ZODIAC_SIGNS.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedSign(z.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-all ${
                    selectedSign === z.id
                      ? "bg-purple-800/60 border-purple-500 text-purple-100 shadow-lg shadow-purple-900/30"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                  }`}
                >
                  <span className="text-xl">{z.emoji}</span>
                  <span className="text-xs">{z.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 文字数 */}
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">📝 台本の文字数</label>
            <div className="flex gap-2 flex-wrap">
              {LENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTargetLength(opt.value)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    targetLength === opt.value
                      ? "bg-purple-800/60 border-purple-500 text-purple-100"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-xs ml-1.5 opacity-60">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isGenerating
              ? <><span className="animate-spin">⭐</span><span>台本を生成中...</span></>
              : <><span>🔮</span><span>{sign.name}の{formatDate(selectedDate)}の台本を生成</span></>
            }
          </button>
        </div>

        {generateError && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">⚠️ {generateError}</div>
        )}

        {/* 台本表示 */}
        {(script || isGenerating) && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
              <span className="text-sm text-gray-400">{sign.emoji} {sign.name} / {formatDate(selectedDate)}</span>
              {script && (
                <button
                  onClick={handleCopy}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    copied ? "bg-green-800/50 border-green-700 text-green-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {copied ? "✓ コピー済み" : "📋 コピー"}
                </button>
              )}
            </div>
            <div className="p-6">
              {isGenerating && !script && (
                <p className="text-purple-400 text-sm animate-pulse">✦ 星々の囁きを紡いでいます...</p>
              )}
              {script && (
                <div className="text-gray-200 leading-8 whitespace-pre-wrap text-sm">
                  {script}
                  {isGenerating && <span className="inline-block w-0.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-middle" />}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 音声生成パネル */}
        {script && !isGenerating && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
              <span>🎙</span>
              <span className="text-sm font-semibold text-purple-300">ElevenLabs 音声生成</span>
            </div>
            <div className="p-6 space-y-5">

              {/* 登録済みボイス一覧 */}
              {savedVoices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ボイスを選択</label>
                  <div className="space-y-2">
                    {savedVoices.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVoiceId(v.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                          selectedVoiceId === v.id
                            ? "bg-indigo-800/40 border-indigo-500 text-indigo-100"
                            : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                        }`}
                      >
                        <div>
                          <span className="font-medium text-sm">{v.name}</span>
                          <span className="text-xs text-gray-500 ml-3 font-mono">{v.voiceId}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteVoice(v.id); }}
                          className="text-gray-600 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-red-900/20"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 新しいボイスを登録 */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-gray-400">＋ 新しいボイスを登録</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ボイス名（例: ユリア）"
                    value={newVoiceName}
                    onChange={(e) => setNewVoiceName(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Voice ID"
                    value={newVoiceId}
                    onChange={(e) => setNewVoiceId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveVoice()}
                    className="flex-[2] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    onClick={handleSaveVoice}
                    disabled={!newVoiceName.trim() || !newVoiceId.trim()}
                    className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-all whitespace-nowrap"
                  >
                    保存
                  </button>
                </div>
                {voiceSaveError && (
                  <p className="text-red-400 text-xs">⚠️ {voiceSaveError}</p>
                )}
                <p className="text-xs text-gray-600">
                  ElevenLabs → Voices → 対象のボイス → Voice ID をコピーして貼り付けてください
                </p>
              </div>

              {/* 言語の上書き */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">言語の上書き</span>
                  <button
                    onClick={() => setLangOverride((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      langOverride ? "bg-violet-600" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        langOverride ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {langOverride && (
                  <select
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
                  >
                    <option value="ja">🇯🇵 日本語</option>
                    <option value="en">🇺🇸 English</option>
                    <option value="zh">🇨🇳 中文</option>
                    <option value="ko">🇰🇷 한국어</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="es">🇪🇸 Español</option>
                  </select>
                )}
              </div>

              {/* 詳細設定 */}
              <div className="border border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                >
                  <span className="font-medium">⚙️ 詳細設定（声質・モデル）</span>
                  <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>▾</span>
                </button>

                {showAdvanced && (
                  <div className="px-4 pb-4 space-y-4 bg-gray-800/30">

                    {/* モデル */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">モデル</label>
                      <select
                        value={modelId}
                        onChange={(e) => setModelId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
                      >
                        <option value="eleven_v3">eleven_v3 ✅ 最高品質・推奨</option>
                        <option value="eleven_flash_v2_5">eleven_flash_v2_5 ✅ 日本語対応・高速</option>
                        <option value="eleven_turbo_v2_5">eleven_turbo_v2_5 ✅ 日本語対応・超高速</option>
                        <option value="eleven_multilingual_v2">eleven_multilingual_v2（言語指定非対応）</option>
                      </select>
                    </div>

                    {/* Stability */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>Stability（安定性）<span className="text-gray-500 ml-1">— 高いほど発音が安定・自然</span></span>
                        <span className="text-violet-300 font-mono">{stability.toFixed(2)}</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={stability}
                        onChange={(e) => setStability(parseFloat(e.target.value))}
                        className="w-full accent-violet-500"
                      />
                      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                        <span>変化豊か</span><span>安定・自然</span>
                      </div>
                    </div>

                    {/* Similarity Boost */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>Similarity Boost<span className="text-gray-500 ml-1">— 高いほど元の声に近い</span></span>
                        <span className="text-violet-300 font-mono">{similarityBoost.toFixed(2)}</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={similarityBoost}
                        onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                        className="w-full accent-violet-500"
                      />
                      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                        <span>低い</span><span>元の声に近い</span>
                      </div>
                    </div>

                    {/* Style Exaggeration */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>Style Exaggeration<span className="text-gray-500 ml-1">— 日本語は低め推奨</span></span>
                        <span className="text-violet-300 font-mono">{styleExaggeration.toFixed(2)}</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={styleExaggeration}
                        onChange={(e) => setStyleExaggeration(parseFloat(e.target.value))}
                        className="w-full accent-violet-500"
                      />
                      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                        <span>自然（推奨）</span><span>大げさ</span>
                      </div>
                    </div>

                    {/* リセット */}
                    <button
                      onClick={() => { setStability(0.75); setSimilarityBoost(0.85); setStyleExaggeration(0.05); setModelId("eleven_v3"); }}
                      className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                    >
                      <span>↺</span><span>推奨値にリセット</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 話し方スタイル */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">話し方のスタイル</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "", label: "指定なし" },
                    { value: "やさしい声", label: "やさしい声" },
                    { value: "力強く", label: "力強く" },
                    { value: "神秘的に", label: "神秘的に" },
                    { value: "囁くように", label: "囁くように" },
                    { value: "情熱的に", label: "情熱的に" },
                    { value: "落ち着いて", label: "落ち着いて" },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => { setSpeakingStyle(s.value); setCustomStyle(""); }}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        speakingStyle === s.value && !customStyle
                          ? "bg-violet-800/50 border-violet-500 text-violet-100"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                      }`}
                    >
                      {s.value ? `[${s.label}]` : s.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="カスタム（例: ゆっくりと威厳を持って）"
                    value={customStyle}
                    onChange={(e) => { setCustomStyle(e.target.value); setSpeakingStyle(""); }}
                    className={`flex-1 bg-gray-800 border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none transition-all ${
                      customStyle ? "border-violet-500" : "border-gray-700 focus:border-gray-600"
                    }`}
                  />
                  {customStyle && (
                    <button
                      onClick={() => setCustomStyle("")}
                      className="text-gray-500 hover:text-gray-300 text-xs px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {(speakingStyle || customStyle) && (
                  <p className="text-xs text-violet-400">
                    送信テキスト先頭に <code className="bg-gray-800 px-1 rounded">[{customStyle || speakingStyle}]</code> を付けて生成します
                  </p>
                )}
              </div>

              {/* 音声生成ボタン */}
              <button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio || savedVoices.length === 0 || !selectedVoiceId}
                className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-700 to-violet-700 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingAudio
                  ? (
                    <>
                      <span className="animate-pulse">🎵</span>
                      <span>
                        {audioProgress.total > 1
                          ? `音声を生成中... (${audioProgress.current}/${audioProgress.total})`
                          : "音声を生成中..."}
                      </span>
                    </>
                  )
                  : <><span>🎙</span><span>音声を生成する</span></>
                }
              </button>

              {audioError && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-300 text-sm">⚠️ {audioError}</div>
              )}

              {/* 音声プレイヤー */}
              {audioUrl && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-green-400">✓ 音声の生成が完了しました</p>
                  <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                  <button
                    onClick={handleDownloadAudio}
                    className="w-full py-2 px-4 rounded-lg border border-gray-600 text-gray-300 text-sm hover:border-gray-500 hover:text-gray-100 transition-all flex items-center justify-center gap-2"
                  >
                    <span>⬇️</span><span>MP3をダウンロード</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* サムネイル生成パネル */}
        {script && !isGenerating && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
              <span>🖼</span>
              <span className="text-sm font-semibold text-purple-300">サムネイル生成</span>
              <span className="text-xs text-gray-600">1280×720px PNG</span>
            </div>
            <div className="p-6 space-y-4">

              {/* 参考サムネイル */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  参考サムネイル <span className="text-gray-500 font-normal">（背景として使用）</span>
                </label>
                <label className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all ${referenceImage ? "border-purple-600 bg-purple-900/10" : "border-gray-700 bg-gray-800/40 hover:border-gray-600"}`}>
                  {referenceImage ? (
                    <div className="relative w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={referenceImage} alt="参考サムネイル" className="w-full rounded-xl object-cover max-h-40" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setReferenceImage(null); setThumbnailGenerated(false); }}
                        className="absolute top-2 right-2 bg-gray-900/80 text-gray-300 hover:text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                      >✕</button>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center gap-2 text-gray-500">
                      <span className="text-2xl">🖼</span>
                      <span className="text-sm">クリックまたはドラッグ＆ドロップ</span>
                      <span className="text-xs text-gray-600">PNG / JPG</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setReferenceImage(ev.target?.result as string);
                        setThumbnailGenerated(false);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>

              {/* キャッチコピー */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  キャッチコピー <span className="text-gray-500 font-normal">（上部に表示・任意）</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 運命の扉が開く日"
                  value={thumbnailTitle}
                  onChange={(e) => { setThumbnailTitle(e.target.value); setThumbnailGenerated(false); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* 生成ボタン */}
              <button
                onClick={generateThumbnail}
                disabled={isGeneratingThumbnail}
                className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingThumbnail
                  ? <><span className="animate-spin">✨</span><span>DALL-E 3で生成中...</span></>
                  : <><span>✨</span><span>AIでサムネイルを生成</span></>
                }
              </button>

              {thumbnailError && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-300 text-sm">⚠️ {thumbnailError}</div>
              )}

              {/* 生成結果 */}
              {thumbnailUrl && (
                <div className="space-y-3">
                  <p className="text-sm text-green-400">✓ 生成完了（1792×1024px）</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailUrl} alt="生成されたサムネイル" className="w-full rounded-xl border border-gray-700" />
                  <button
                    onClick={handleDownloadThumbnail}
                    className="w-full py-2 px-4 rounded-lg border border-gray-600 text-gray-300 text-sm hover:border-gray-500 hover:text-gray-100 transition-all flex items-center justify-center gap-2"
                  >
                    <span>⬇️</span><span>PNGをダウンロード</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
