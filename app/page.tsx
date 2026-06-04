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

  // ダウンロード用の音声データ
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);

  // 台本完了後に自動で音声生成するか
  const [autoGenerateAudio, setAutoGenerateAudio] = useState(false);

  // 無料鑑定・公式LINE誘導CTAを含めるか
  const [includeLineCta, setIncludeLineCta] = useState(true);

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
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const audioRef = useRef<HTMLAudioElement>(null);

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
    setAudioData(null);

    let finalScript = "";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign: selectedSign, date: selectedDate, targetLength, includeLineCta }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "生成に失敗しました");
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        finalScript += decoder.decode(value, { stream: true });
        setScript(finalScript);
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "エラーが発生しました");
      return;
    } finally {
      setIsGenerating(false);
    }

    if (autoGenerateAudio && finalScript) {
      await handleGenerateAudio(finalScript);
    }
  }

  // ---- テキスト分割（2000字以内のチャンクに） ----
  function splitText(text: string, maxLen = 2000): string[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let current = "";

    for (const para of paragraphs) {
      const separator = current ? "\n\n" : "";
      if ((current + separator + para).length <= maxLen) {
        current += separator + para;
      } else {
        if (current) chunks.push(current);
        if (para.length > maxLen) {
          const sentences = para.split(/(?<=。|！|？|\n)/);
          current = "";
          for (const s of sentences) {
            if ((current + s).length <= maxLen) {
              current += s;
            } else {
              if (current) chunks.push(current);
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
  async function handleGenerateAudio(scriptOverride?: string) {
    const targetScript = scriptOverride ?? script;
    if (!targetScript) return;
    const voice = savedVoices.find((v) => v.id === selectedVoiceId);
    if (!voice) { setAudioError("ボイスを選択してください"); return; }

    setIsGeneratingAudio(true);
    setAudioError("");
    setAudioUrl("");

    try {
      const chunks = splitText(targetScript, 2000);
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

      // ID3タグを除去してから結合（2つ目以降のID3ヘッダーがデコーダーを壊すため）
      function stripId3(buffer: ArrayBuffer): ArrayBuffer {
        const bytes = new Uint8Array(buffer);
        let start = 0;
        let end = bytes.length;
        // ID3v2ヘッダーを先頭から除去
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
          const size =
            ((bytes[6] & 0x7f) << 21) |
            ((bytes[7] & 0x7f) << 14) |
            ((bytes[8] & 0x7f) << 7) |
            (bytes[9] & 0x7f);
          start = size + 10;
        }
        // ID3v1タグを末尾から除去
        if (end >= 128 && bytes[end - 128] === 0x54 && bytes[end - 127] === 0x41 && bytes[end - 126] === 0x47) {
          end -= 128;
        }
        return buffer.slice(start, end);
      }

      const stripped = buffers.map((buf) => stripId3(buf));

      // 最初のフレームからMP3パラメータを取得して2秒の無音を生成
      function parseMp3Params(data: ArrayBuffer): { bitrate: number; sampleRate: number; byte3: number } | null {
        const d = new Uint8Array(data);
        let pos = 0;
        while (pos < d.length - 3 && !(d[pos] === 0xFF && (d[pos + 1] & 0xE0) === 0xE0)) pos++;
        if (pos + 4 > d.length) return null;
        const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
        const SAMPLERATES = [44100, 48000, 32000, 0];
        const bitrate = BITRATES[(d[pos + 2] >> 4) & 0xF] * 1000;
        const sampleRate = SAMPLERATES[(d[pos + 2] >> 2) & 0x3];
        if (!bitrate || !sampleRate) return null;
        return { bitrate, sampleRate, byte3: d[pos + 3] };
      }

      function createSilence(seconds: number, bitrate: number, sampleRate: number, byte3: number): Uint8Array {
        const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
        const SAMPLERATES = [44100, 48000, 32000, 0];
        const bitrateIdx = BITRATES.indexOf(bitrate / 1000);
        const srateIdx = SAMPLERATES.indexOf(sampleRate);
        const frameSize = Math.floor(144 * bitrate / sampleRate);
        const framesNeeded = Math.ceil(seconds * sampleRate / 1152);
        const result = new Uint8Array(framesNeeded * frameSize);
        for (let i = 0; i < framesNeeded; i++) {
          const off = i * frameSize;
          result[off] = 0xFF;
          result[off + 1] = 0xFB; // MPEG1, Layer3, no CRC
          result[off + 2] = (bitrateIdx << 4) | (srateIdx << 2);
          result[off + 3] = byte3;
          // 残りはゼロ（無音フレーム）
        }
        return result;
      }

      const params = parseMp3Params(stripped[0]);
      const silence = params ? createSilence(2, params.bitrate, params.sampleRate, params.byte3) : new Uint8Array(0);

      // チャンク間に2秒の無音を挿入して結合
      const parts: Uint8Array[] = [];
      for (let i = 0; i < stripped.length; i++) {
        parts.push(new Uint8Array(stripped[i]));
        if (i < stripped.length - 1) parts.push(silence);
      }
      const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const part of parts) {
        merged.set(part, offset);
        offset += part.byteLength;
      }

      // Xing/Info VBRフレームを除去（誤った再生時間メタデータを持つため）
      function removeVbrFrame(data: Uint8Array): Uint8Array {
        let pos = 0;
        while (pos < data.length - 3 && !(data[pos] === 0xFF && (data[pos + 1] & 0xE0) === 0xE0)) pos++;
        if (pos + 4 > data.length) return data;
        const b2 = data[pos + 2];
        const b3 = data[pos + 3];
        const bitrateIdx = (b2 >> 4) & 0xF;
        const srateIdx = (b2 >> 2) & 0x3;
        const padding = (b2 >> 1) & 0x1;
        const channelMode = (b3 >> 6) & 0x3;
        const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
        const SAMPLERATES = [44100, 48000, 32000, 0];
        const bitrate = BITRATES[bitrateIdx] * 1000;
        const sampleRate = SAMPLERATES[srateIdx];
        if (!bitrate || !sampleRate) return data;
        const frameSize = Math.floor(144 * bitrate / sampleRate) + padding;
        const sideInfoSize = channelMode === 3 ? 17 : 32;
        const xingOffset = pos + 4 + sideInfoSize;
        if (xingOffset + 4 <= data.length) {
          const tag = String.fromCharCode(data[xingOffset], data[xingOffset + 1], data[xingOffset + 2], data[xingOffset + 3]);
          if (tag === "Xing" || tag === "Info") {
            return data.slice(pos + frameSize);
          }
        }
        return data;
      }

      const final = removeVbrFrame(merged);
      setAudioData(final);
      const blob = new Blob([new Uint8Array(final)], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setTimeout(() => audioRef.current?.play(), 100);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "音声生成に失敗しました");
    } finally {
      setIsGeneratingAudio(false);
      setAudioProgress({ current: 0, total: 0 });
    }
  }

  async function handleCopy() {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadAudio() {
    if (!audioData) return;
    const blob = new Blob([new Uint8Array(audioData)], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sign.name}_${selectedDate}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
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

          {/* 無料鑑定・公式LINE誘導トグル */}
          <div
            onClick={() => setIncludeLineCta((v) => !v)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all select-none ${
              includeLineCta
                ? "bg-green-900/40 border-green-600"
                : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
            }`}
          >
            <div>
              <p className={`text-sm font-medium ${includeLineCta ? "text-green-200" : "text-gray-300"}`}>
                💚 無料鑑定・公式LINE誘導を含める
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {includeLineCta ? "台本に「概要欄の公式LINEから無料鑑定」のCTAを追加します" : "LINE誘導のCTAは含めません"}
              </p>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${includeLineCta ? "bg-green-600" : "bg-gray-600"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includeLineCta ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </div>

          {/* 自動音声生成トグル */}
          <div
            onClick={() => setAutoGenerateAudio((v) => !v)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all select-none ${
              autoGenerateAudio
                ? "bg-indigo-900/40 border-indigo-600"
                : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
            }`}
          >
            <div>
              <p className={`text-sm font-medium ${autoGenerateAudio ? "text-indigo-200" : "text-gray-300"}`}>
                🎙 台本完了後に自動で音声生成する
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {autoGenerateAudio ? "台本生成が終わり次第、自動で音声生成を開始します" : "台本生成後に手動で音声生成ボタンを押します"}
              </p>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${autoGenerateAudio ? "bg-indigo-600" : "bg-gray-600"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoGenerateAudio ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || isGeneratingAudio}
            className="w-full py-3 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isGenerating
              ? <><span className="animate-spin">⭐</span><span>台本を生成中...</span></>
              : <><span>🔮</span><span>{sign.name}の{formatDate(selectedDate)}の台本を生成</span></>
            }
          </button>
        </div>

        {/* ElevenLabs 声の設定（常時表示） */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
            <span>🎙</span>
            <span className="text-sm font-semibold text-purple-300">ElevenLabs 声の設定</span>
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
                  className={`relative w-11 h-6 rounded-full transition-colors ${langOverride ? "bg-violet-600" : "bg-gray-600"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${langOverride ? "translate-x-5" : "translate-x-0.5"}`} />
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
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Stability（安定性）<span className="text-gray-500 ml-1">— 高いほど発音が安定・自然</span></span>
                      <span className="text-violet-300 font-mono">{stability.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={stability} onChange={(e) => setStability(parseFloat(e.target.value))} className="w-full accent-violet-500" />
                    <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>変化豊か</span><span>安定・自然</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Similarity Boost<span className="text-gray-500 ml-1">— 高いほど元の声に近い</span></span>
                      <span className="text-violet-300 font-mono">{similarityBoost.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={similarityBoost} onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))} className="w-full accent-violet-500" />
                    <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>低い</span><span>元の声に近い</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Style Exaggeration<span className="text-gray-500 ml-1">— 日本語は低め推奨</span></span>
                      <span className="text-violet-300 font-mono">{styleExaggeration.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={styleExaggeration} onChange={(e) => setStyleExaggeration(parseFloat(e.target.value))} className="w-full accent-violet-500" />
                    <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>自然（推奨）</span><span>大げさ</span></div>
                  </div>
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
                  <button onClick={() => setCustomStyle("")} className="text-gray-500 hover:text-gray-300 text-xs px-2">✕</button>
                )}
              </div>
              {(speakingStyle || customStyle) && (
                <p className="text-xs text-violet-400">
                  送信テキスト先頭に <code className="bg-gray-800 px-1 rounded">[{customStyle || speakingStyle}]</code> を付けて生成します
                </p>
              )}
            </div>
          </div>
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

        {/* 音声生成ボタン・プレイヤー */}
        {script && !isGenerating && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <button
              onClick={() => handleGenerateAudio()}
              disabled={isGeneratingAudio || savedVoices.length === 0 || !selectedVoiceId}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-700 to-violet-700 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isGeneratingAudio
                ? <><span className="animate-pulse">🎵</span><span>{audioProgress.total > 1 ? `音声を生成中... (${audioProgress.current}/${audioProgress.total})` : "音声を生成中..."}</span></>
                : <><span>🎙</span><span>音声を生成する</span></>
              }
            </button>
            {audioError && (
              <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-300 text-sm">⚠️ {audioError}</div>
            )}
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
        )}
      </div>
    </main>
  );
}
