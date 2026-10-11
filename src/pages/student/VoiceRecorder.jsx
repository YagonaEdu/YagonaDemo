import { useEffect, useRef, useState } from "react";
import { IconMic, IconStop } from "./icons";

const MAX_SECONDS = 10 * 60;

/** Chrome/Firefox record webm/opus; Safari only mp4 (saved as .m4a, accepted by the API). */
function pickFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", type: "audio/webm", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported?.("audio/webm")) {
    return { mimeType: "audio/webm", type: "audio/webm", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported?.("audio/mp4")) {
    return { mimeType: "audio/mp4", type: "audio/mp4", ext: "m4a" };
  }
  return null;
}

function clock(seconds) {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VoiceRecorder({ disabled, onRecorded }) {
  const [format] = useState(pickFormat);
  const [phase, setPhase] = useState("idle"); // idle | recording | review
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [take, setTake] = useState(null); // { file, url }
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);

  const releaseStream = () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      releaseStream();
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );
  useEffect(() => () => take && URL.revokeObjectURL(take.url), [take]);

  if (!format || !navigator.mediaDevices?.getUserMedia) {
    return (
      <p className="st-rec-note">
        Запись голоса в этом браузере недоступна — загрузите аудиофайл (MP3, M4A, WEBM).
      </p>
    );
  }

  const start = async () => {
    setError("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (exc) {
      setError(
        exc?.name === "NotAllowedError"
          ? "Нет доступа к микрофону. Разрешите его в настройках браузера."
          : "Микрофон не найден или занят другим приложением.",
      );
      return;
    }
    const chunks = [];
    const rec = new MediaRecorder(stream.current, { mimeType: format.mimeType });
    rec.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    rec.onstop = () => {
      releaseStream();
      const blob = new Blob(chunks, { type: format.type });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const file = new File([blob], `voice-${stamp}.${format.ext}`, { type: format.type });
      setTake({ file, url: URL.createObjectURL(blob) });
      setPhase("review");
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setPhase("recording");
    timer.current = setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= MAX_SECONDS) rec.state === "recording" && rec.stop();
        return value + 1;
      });
    }, 1000);
  };

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();

  const reset = () => {
    setTake(null);
    setPhase("idle");
    setSeconds(0);
  };

  const attach = () => {
    onRecorded(take.file);
    reset();
  };

  return (
    <div className={`st-rec is-${phase}`}>
      {phase === "idle" ? (
        <button type="button" className="st-rec-btn" onClick={start} disabled={disabled}>
          <IconMic size={18} />
          Записать голос
        </button>
      ) : null}

      {phase === "recording" ? (
        <div className="st-rec-live">
          <span className="st-rec-dot" aria-hidden="true" />
          <span className="st-rec-time" aria-live="off">
            {clock(seconds)}
          </span>
          <span className="st-rec-limit">из {clock(MAX_SECONDS)}</span>
          <button type="button" className="st-rec-btn is-stop" onClick={stop}>
            <IconStop size={18} />
            Остановить
          </button>
        </div>
      ) : null}

      {phase === "review" && take ? (
        <div className="st-rec-review">
          <audio controls src={take.url} aria-label="Прослушать запись" />
          <div className="st-rec-actions">
            <button type="button" className="y-btn y-btn-primary y-btn-sm" onClick={attach}>
              Прикрепить запись
            </button>
            <button type="button" className="y-btn y-btn-ghost y-btn-sm" onClick={reset}>
              Записать заново
            </button>
          </div>
        </div>
      ) : null}

      <p className="st-rec-status" role="status">
        {phase === "recording" ? "Идёт запись…" : ""}
      </p>
      {error ? (
        <p className="st-rec-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
