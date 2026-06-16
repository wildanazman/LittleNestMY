import { supabase, isSupabaseConfigured } from "./supabaseClient.mjs";
import { getAuthSession } from "./localAuth.mjs";

const AVATAR_BUCKET = "avatars";

/**
 * Persist an avatar data-URL. When the user is logged in and Supabase Storage
 * is reachable, uploads the image to the `avatars` bucket and returns a public
 * URL (small, syncs across devices). On any failure — no Supabase, guest mode,
 * missing bucket, RLS — it returns the original data-URL unchanged, so the
 * existing local-only behavior always still works.
 */
export async function persistAvatar(dataUrl, options = {}) {
  const folder = options.folder || "avatar";
  if (!dataUrl || !String(dataUrl).startsWith("data:")) return dataUrl || "";
  if (!isSupabaseConfigured) return dataUrl;
  try {
    const session = await getAuthSession();
    if (!session?.user) return dataUrl; // guest → keep local data-URL
    const blob = await (await fetch(dataUrl)).blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${session.user.id}/${folder}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) return dataUrl;
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return data?.publicUrl || dataUrl;
  } catch {
    return dataUrl;
  }
}

export async function fileToResizedDataUrl(file, options = {}) {
  const {
    maxSize = 720,
    quality = 0.82,
    maxBytes = 2_500_000
  } = options;

  if (!file) return "";
  if (!file.type?.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > maxBytes * 3) {
    throw new Error("That image is quite large. Please choose a smaller photo.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  if (dataUrl.length > maxBytes) {
    throw new Error("The photo is still too large after resizing. Please try a smaller image.");
  }

  return dataUrl;
}

export async function fileToCroppedAvatarDataUrl(file, options = {}) {
  const {
    outputSize = 640,
    quality = 0.84,
    maxBytes = 2_500_000,
    title = "Adjust photo",
    helpText = "Move the sliders until the face sits nicely inside the circle."
  } = options;

  if (!file) return "";
  if (!file.type?.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > maxBytes * 3) {
    throw new Error("That image is quite large. Please choose a smaller photo.");
  }

  const image = await loadImage(file);
  const crop = await openCropDialog(image, { title, helpText });
  if (!crop) return "";

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fbf9f4";
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceSize,
    crop.sourceSize,
    0,
    0,
    outputSize,
    outputSize
  );
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (dataUrl.length > maxBytes) {
    throw new Error("The cropped photo is still too large. Please try a smaller image.");
  }
  return dataUrl;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error("We could not read that image. Please try another photo."));
    };
    image.src = URL.createObjectURL(file);
  });
}

function openCropDialog(image, options) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/45 px-5 pb-6 pt-10 overflow-y-auto";
    modal.innerHTML = `
      <div class="w-full max-w-md rounded-[28px] bg-surface-container-lowest text-on-surface shadow-2xl border border-white/40 p-5 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-label-sm text-label-sm text-primary uppercase tracking-wider">Photo crop</p>
            <h2 class="font-headline-md text-headline-md">${escapeHtml(options.title)}</h2>
            <p class="font-body-md text-body-md text-on-surface-variant">${escapeHtml(options.helpText)}</p>
          </div>
          <button class="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center" data-crop-cancel type="button" aria-label="Cancel photo crop">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="mx-auto relative w-64 h-64 max-w-full rounded-full overflow-hidden bg-surface-container border-4 border-primary-container shadow-inner">
          <canvas class="w-full h-full" data-crop-preview width="256" height="256"></canvas>
        </div>
        <div class="space-y-3">
          ${rangeControl("Zoom", "zoom", 100, 260, 120)}
          ${rangeControl("Left / Right", "x", -100, 100, 0)}
          ${rangeControl("Up / Down", "y", -100, 100, 0)}
        </div>
        <button class="w-full h-12 rounded-full bg-primary text-on-primary font-label-md text-label-md active:scale-95 transition-transform" data-crop-apply type="button">Use this photo</button>
      </div>
    `;

    document.body.appendChild(modal);
    const preview = modal.querySelector("[data-crop-preview]");
    const context = preview.getContext("2d");
    const zoomInput = modal.querySelector("[data-crop-control='zoom']");
    const xInput = modal.querySelector("[data-crop-control='x']");
    const yInput = modal.querySelector("[data-crop-control='y']");

    const getCrop = () => calculateCrop(image, {
      zoom: Number(zoomInput.value) / 100,
      x: Number(xInput.value) / 100,
      y: Number(yInput.value) / 100
    });

    const render = () => {
      const crop = getCrop();
      context.clearRect(0, 0, preview.width, preview.height);
      context.drawImage(image, crop.sourceX, crop.sourceY, crop.sourceSize, crop.sourceSize, 0, 0, preview.width, preview.height);
    };

    [zoomInput, xInput, yInput].forEach((input) => input.addEventListener("input", render));
    modal.querySelector("[data-crop-cancel]").addEventListener("click", () => close(null));
    modal.querySelector("[data-crop-apply]").addEventListener("click", () => close(getCrop()));
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close(null);
    });

    render();

    function close(result) {
      modal.remove();
      resolve(result);
    }
  });
}

function calculateCrop(image, controls) {
  const shortestSide = Math.min(image.width, image.height);
  const sourceSize = Math.max(1, Math.min(shortestSide / controls.zoom, shortestSide));
  const maxX = Math.max(0, image.width - sourceSize);
  const maxY = Math.max(0, image.height - sourceSize);
  return {
    sourceX: Math.round((maxX / 2) + (controls.x * maxX / 2)),
    sourceY: Math.round((maxY / 2) + (controls.y * maxY / 2)),
    sourceSize: Math.round(sourceSize)
  };
}

function rangeControl(label, name, min, max, value) {
  return `
    <label class="block">
      <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
      <input class="mt-1 w-full accent-primary" data-crop-control="${name}" type="range" min="${min}" max="${max}" value="${value}"/>
    </label>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
