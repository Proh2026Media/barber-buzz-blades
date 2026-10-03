import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { t } from "@/lib/i18n";
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
    return new Error(t("brand.upload.bucketMissing", { label }));
  }
  return error instanceof Error ? error : new Error(t("brand.upload.sendFailed", { label }));
}

export function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(t("brand.upload.readFile")));
    reader.readAsDataURL(file);
  });
}

/**
 * Envia o logo ao bucket público em caminho versionado e devolve a URL.
 * O caminho novo não sobrescreve o logo publicado: o antigo só é apagado
 * depois que a identidade for gravada no banco.
 */
export async function uploadShopLogo(shopId: string, file: File) {
  const path = `${shopId}/logo-${Date.now()}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw storageError(error, t("brand.upload.labelLogos"));
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Publica a foto de fundo do login, também em caminho versionado. */
export async function uploadShopLoginImage(shopId: string, file: File) {
  const path = `${shopId}/login-background-${Date.now()}.webp`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw storageError(error, t("brand.upload.labelLoginImages"));
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Caminho do arquivo dentro de um bucket público a partir da URL publicada. */
function bucketPath(bucket: string, url: string | null | undefined) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const path = url.split(marker)[1]?.split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/** Remove arquivos do bucket de logos; falhas de limpeza não desfazem o salvamento. */
async function removeLogoBucketFiles(urls: Array<string | null | undefined>) {
  const paths = urls
    .map((url) => bucketPath(LOGO_BUCKET, url))
    .filter((path): path is string => Boolean(path));
  if (!paths.length) return;
  try {
    await supabase.storage.from(LOGO_BUCKET).remove([...new Set(paths)]);
  } catch {
    // Um arquivo antigo que sobrar no bucket não afeta a identidade gravada.
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
      if (error) throw storageError(error, t("brand.upload.labelFonts"));
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
  return bucketPath(FONT_BUCKET, url);
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
 * Os arquivos novos sobem em caminhos versionados; os antigos só são apagados
 * depois que o banco aceitar a mudança. Se a gravação falhar (rede, sessão,
 * aprovação de sócio), os arquivos recém-enviados são removidos e os publicados
 * continuam intactos.
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
  if (mode === "demo") {
    if (logoFile) values.logo_url = await fileAsDataUrl(logoFile);
    if (loginImageFile) values.login_image_url = await fileAsDataUrl(loginImageFile);
    if (fontFaces?.length) {
      const records = await Promise.all(
        fontFaces.map(async (face) => ({
          url: await fileAsDataUrl(face.file),
          file_name: face.file_name,
          weight: face.weight,
          style: face.style,
        })),
      );
      values.custom_font_faces = records;
      values.custom_font_url = records.find((face) => face.weight === 400)?.url ?? records[0]!.url;
      values.custom_font_name = draft.custom_font_name || "Fonte personalizada";
    } else if (settings.custom_font_url && !values.custom_font_url) {
      values.custom_font_faces = [];
    }
    return { ...settings, ...values, updated_at: new Date().toISOString() };
  }

  const shopId = settings.barbershop_id;
  const newLogoUrls: string[] = [];
  let newFontRecords: BrandFontFaceRecord[] = [];
  const oldLogoUrls: Array<string | null | undefined> = [];
  let removeOldFonts = false;

  try {
    if (logoFile) {
      values.logo_url = await uploadShopLogo(shopId, logoFile);
      newLogoUrls.push(values.logo_url);
      oldLogoUrls.push(settings.logo_url);
    } else if (settings.logo_url && !values.logo_url) {
      oldLogoUrls.push(settings.logo_url);
    }
    if (loginImageFile) {
      values.login_image_url = await uploadShopLoginImage(shopId, loginImageFile);
      newLogoUrls.push(values.login_image_url);
      oldLogoUrls.push(settings.login_image_url);
    } else if (settings.login_image_url && !values.login_image_url) {
      oldLogoUrls.push(settings.login_image_url);
    }
    if (fontFaces?.length) {
      newFontRecords = await uploadShopFontFaces(shopId, fontFaces);
      values.custom_font_faces = newFontRecords;
      values.custom_font_url =
        newFontRecords.find((face) => face.weight === 400)?.url ?? newFontRecords[0]!.url;
      values.custom_font_name = draft.custom_font_name || "Fonte personalizada";
      removeOldFonts = true;
    } else if (settings.custom_font_url && !values.custom_font_url) {
      values.custom_font_faces = [];
      removeOldFonts = true;
    }

    const { data, error } = await supabase
      .from("barbershop_settings")
      .update(values)
      .eq("barbershop_id", shopId)
      .select("*")
      .single();
    if (error) throw error;

    // Só agora, com o banco apontando para os arquivos novos, limpa os antigos.
    // O mesmo caminho nunca é apagado se continuar em uso (caso legado).
    await removeLogoBucketFiles(
      oldLogoUrls.filter(
        (url) =>
          bucketPath(LOGO_BUCKET, url) !== bucketPath(LOGO_BUCKET, data.logo_url) &&
          bucketPath(LOGO_BUCKET, url) !== bucketPath(LOGO_BUCKET, data.login_image_url),
      ),
    );
    if (removeOldFonts) {
      await removeShopFonts(
        normalizeFontFaces(settings.custom_font_faces),
        settings.custom_font_url,
      );
    }
    return data;
  } catch (error) {
    // Desfaz os envios desta tentativa; o que já estava publicado fica como estava.
    await removeLogoBucketFiles(newLogoUrls);
    if (newFontRecords.length) await removeShopFonts(newFontRecords);
    throw error;
  }
}
