// Best-effort in-browser video shrinker for memory clips.
//
// Re-encodes a (short) video blob to a smaller resolution + bitrate using a
// canvas capture stream + MediaRecorder, to save Supabase storage. The app's
// in-app recordings are already silent (getUserMedia is video-only), so the
// audio-less canvas re-encode is consistent. ALWAYS falls back to the original
// blob on any failure or if the result isn't smaller, so it can never make a
// clip unusable.

export async function compressVideoBlob(blob, options = {}) {
  const { maxSize = 480, bitrate = 350_000, maxDurationSec = 5.6, fps = 24 } = options;
  try {
    if (!blob || typeof MediaRecorder === "undefined") return blob;
    const canvasProto = typeof HTMLCanvasElement !== "undefined" ? HTMLCanvasElement.prototype : null;
    if (!canvasProto || !canvasProto.captureStream) return blob;

    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("video load failed"));
    });

    const srcW = video.videoWidth || 0;
    const srcH = video.videoHeight || 0;
    if (!srcW || !srcH) { URL.revokeObjectURL(url); return blob; }

    const duration = Math.min(video.duration || maxDurationSec, maxDurationSec);
    const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
    const w = Math.max(2, Math.round(srcW * scale));
    const h = Math.max(2, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(fps);
    const mime = ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate })
      : new MediaRecorder(stream, { videoBitsPerSecond: bitrate });

    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

    recorder.start();
    await video.play().catch(() => {});

    const start = performance.now();
    await new Promise((resolve) => {
      const draw = () => {
        ctx.drawImage(video, 0, 0, w, h);
        if (video.ended || (performance.now() - start) / 1000 >= duration) { resolve(); return; }
        requestAnimationFrame(draw);
      };
      draw();
    });

    recorder.stop();
    await stopped;
    video.pause();
    URL.revokeObjectURL(url);

    const out = new Blob(chunks, { type: mime || "video/webm" });
    return (out.size > 0 && out.size < blob.size) ? out : blob;
  } catch {
    return blob;
  }
}
