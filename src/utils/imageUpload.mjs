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
