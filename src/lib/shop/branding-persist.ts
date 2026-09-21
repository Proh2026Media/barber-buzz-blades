import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { brandDraftToSettings, type BrandDraft } from "./branding";
import {
  normalizeFontFaces,
  type BrandFontFaceRecord,
  type PendingBrandFontFace,
} from "./font-files.ts";

export const LOGO_BUCKET = "barbershop-logos";
export const FONT_BUCKET = "barbershop-fonts";

function storageError(error: unknown, label: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (/bucket not found/i.test(message)) {
    return new Error(
      `O armazenamento de ${label} ainda não está configurado. Atualize a página e tente novamente.`,
    );
  }
  return error instanceof Error ? error : new Error(`Não foi possível enviar ${label}.`);
}

export function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

/** Envia o logo ao bucket público e devolve a URL com cache-busting. */
export async function uploadShopLogo(shopId: string, file: File) {
  const path = `${shopId}/logo`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw storageError(error, "logos");
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Publica a foto de fundo do login no mesmo bucket visual da barbearia. */
export async function uploadShopLoginImage(shopId: string, file: File) {
  const path = `${shopId}/login-background.webp`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw storageError(error, "imagens do login");
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Remove o arquivo do bucket; falhas não impedem salvar a identidade sem logo. */
export async function removeShopLogo(shopId: string) {
  try {
    await supabase.storage.from(LOGO_BUCKET).remove([`${shopId}/logo`]);
  } catch {
    // O registro fica sem logo mesmo se a limpeza do arquivo falhar.
  }
}

export async function removeShopLoginImage(shopId: string) {
  try {
    await supabase.storage.from(LOGO_BUCKET).remove([`${shopId}/login-background.webp`]);
  } catch {
    // A configuração pode voltar à foto padrão mesmo se o arquivo antigo não puder ser removido.
  }
}

/** Envia a fonte ao bucket público e devolve uma URL versionada. */
function fontContentType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "woff2";
  const webFontTypes: Record<string, string> = {
    woff2: "font/woff2",
    woff: "font/woff",
    ttf: "font/ttf",
    otf: "font/otf",
  };
  return webFontTypes[extension] ?? file.type;
}

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uploadShopFontFaces(shopId: string, faces: PendingBrandFontFace[]) {
  const version = Date.now();
  const uploaded: string[] = [];
  const records: BrandFontFaceRecord[] = [];
  try {
    for (const [index, face] of faces.entries()) {
      const path = `${shopId}/family/${version}-${index}-${safeFileName(face.file.name)}`;
      const { error } = await supabase.storage.from(FONT_BUCKET).upload(path, face.file, {
        contentType: fontContentType(face.file),
        upsert: false,
        cacheControl: "31536000",
      });
      if (error) throw storageError(error, "fontes");
      uploaded.push(path);
      const { data } = supabase.storage.from(FONT_BUCKET).getPublicUrl(path);
      records.push({
        url: `${data.publicUrl}?v=${version}`,
        file_name: face.file_name,
        weight: face.weight,
        style: face.style,
      });
    }
    return records;
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(FONT_BUCKET).remove(uploaded);
    throw error;
  }
}

function fontPath(url: string) {
  const marker = `/storage/v1/object/public/${FONT_BUCKET}/`;
  const path = url.split(marker)[1]?.split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

export async function removeShopFonts(
  currentFaces: BrandFontFaceRecord[],
  currentUrl?: string | null,
) {
  try {
    const paths = [
      ...currentFaces.map((face) => fontPath(face.url)),
      fontPath(currentUrl ?? ""),
    ].filter((path): path is string => Boolean(path));
    if (paths.length) await supabase.storage.from(FONT_BUCKET).remove([...new Set(paths)]);
  } catch {
    // O registro pode voltar à fonte da biblioteca mesmo se o arquivo antigo não for removido.
  }
}

/**
 * Persiste a identidade visual de uma barbearia.
 * No modo demo o logo vira Data URL e nada toca o Supabase.
 */
export async function persistBrandIdentity(
  settings: Tables<"barbershop_settings">,
  draft: BrandDraft,
  logoFile: File | null,
  fontFaces: PendingBrandFontFace[] | null,
  mode: "supabase" | "demo",
  loginImageFile: File | null = null,
): Promise<Tables<"barbershop_settings">> {
  const values = brandDraftToSettings(draft);
  if (logoFile) {
    values.logo_url =
      mode === "demo"
        ? await fileAsDataUrl(logoFile)
        : await uploadShopLogo(settings.barbershop_id, logoFile);
  } else if (mode === "supabase" && settings.logo_url && !values.logo_url) {
    await removeShopLogo(settings.barbershop_id);
  }
  if (loginImageFile) {
    values.login_image_url =
      mode === "demo"
        ? await fileAsDataUrl(loginImageFile)
        : await uploadShopLoginImage(settings.barbershop_id, loginImageFile);
  } else if (mode === "supabase" && settings.login_image_url && !values.login_image_url) {
    await removeShopLoginImage(settings.barbershop_id);
  }
  if (fontFaces?.length) {
    const records =
      mode === "demo"
        ? await Promise.all(
            fontFaces.map(async (face) => ({
              url: await fileAsDataUrl(face.file),
              file_name: face.file_name,
              weight: face.weight,
              style: face.style,
            })),
          )
        : await uploadShopFontFaces(settings.barbershop_id, fontFaces);
    values.custom_font_faces = records;
    values.custom_font_url = records.find((face) => face.weight === 400)?.url ?? records[0]!.url;
    values.custom_font_name = draft.custom_font_name || "Fonte personalizada";
    if (mode === "supabase") {
      await removeShopFonts(
        normalizeFontFaces(settings.custom_font_faces),
        settings.custom_font_url,
      );
    }
  } else if (mode === "supabase" && settings.custom_font_url && !values.custom_font_url) {
    await removeShopFonts(normalizeFontFaces(settings.custom_font_faces), settings.custom_font_url);
    values.custom_font_faces = [];
  }
  if (mode === "demo") {
    return { ...settings, ...values, updated_at: new Date().toISOString() };
  }
  const { data, error } = await supabase
    .from("barbershop_settings")
    .update(values)
    .eq("barbershop_id", settings.barbershop_id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
