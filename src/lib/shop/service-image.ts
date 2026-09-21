import { supabase } from "@/integrations/supabase/client";

export const SERVICE_IMAGE_BUCKET = "barbershop-services";
export const SERVICE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const SERVICE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
export const SERVICE_IMAGE_CROP_SIZE = 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function isServiceImageSource(value: string | null | undefined): value is string {
  return Boolean(value && (/^https?:\/\//i.test(value) || value.startsWith("data:image/")));
}

export function validateServiceImage(file: File): string | null {
  if (!EXTENSION_BY_TYPE[file.type]) {
    return "Use uma imagem PNG, JPEG, WebP ou SVG.";
  }
  if (file.size > SERVICE_IMAGE_MAX_BYTES) {
    return "A imagem deve ter no máximo 2 MB.";
  }
  if (file.size === 0) {
    return "A imagem selecionada está vazia.";
  }
  return null;
}

export function serviceImageToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Não foi possível ler a imagem.")),
    );
    reader.addEventListener("error", () => reject(new Error("Não foi possível ler a imagem.")));
    reader.readAsDataURL(file);
  });
}

export async function uploadServiceImage(shopId: string, file: File) {
  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) throw new Error("Formato de imagem não aceito.");

  const path = `${shopId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(SERVICE_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SERVICE_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
