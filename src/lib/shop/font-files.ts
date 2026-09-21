export type BrandFontStyle = "normal" | "italic";

export type BrandFontFaceRecord = {
  url: string;
  file_name: string;
  weight: number;
  style: BrandFontStyle;
};

export type PendingBrandFontFace = Omit<BrandFontFaceRecord, "url"> & {
  file: File;
  preview_url: string;
};

function validateSelectedFont(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["woff2", "woff", "ttf", "otf"].includes(extension ?? "")) {
    return "Use uma fonte WOFF2, WOFF, TTF ou OTF.";
  }
  if (file.size > 5 * 1024 * 1024) return "A fonte deve ter no máximo 5 MB.";
  return null;
}

const WEIGHTS: [RegExp, number][] = [
  [/(?:extra|ultra)[-_ ]?(?:black|heavy)/i, 900],
  [/(?:extra|ultra)[-_ ]?light/i, 200],
  [/(?:semi|demi)[-_ ]?bold/i, 600],
  [/(?:extra|ultra)[-_ ]?bold/i, 800],
  [/(?:thin|hairline)/i, 100],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
  [/(?:black|heavy)/i, 900],
];

const FACE_WORDS =
  /(?:extra|ultra)[-_ ]?(?:black|heavy|light|bold)|(?:semi|demi)[-_ ]?bold|thin|hairline|light|regular|normal|book|roman|medium|bold|black|heavy|italic|oblique|slanted/gi;

/**
 * Remove identificadores acrescentados por bundlers/CDNs, como os dois hashes em
 * `BenguiatProITC-Bold.ba7977b0.1401f2e7.woff2`. Eles não fazem parte do nome
 * da família e cada face costuma receber hashes diferentes.
 */
function stripBuildHashes(value: string) {
  let clean = value;
  while (/[._-][a-f\d]{8,}$/i.test(clean)) clean = clean.replace(/[._-][a-f\d]{8,}$/i, "");
  return clean;
}

function numericWeight(value: string) {
  const match = value.match(
    /(?:^|[-_. ])([1-9]00)(?=(?:(?:italic|oblique|slanted))?(?:$|[-_. ]))/i,
  );
  return match ? Number(match[1]) : null;
}

export function inferFontFile(file: Pick<File, "name">) {
  const base = stripBuildHashes(file.name.replace(/^\._/, "").replace(/\.(woff2?|ttf|otf)$/i, ""));
  const style: BrandFontStyle = /(?:italic|oblique|slanted)/i.test(base) ? "italic" : "normal";
  const weight = WEIGHTS.find(([pattern]) => pattern.test(base))?.[1] ?? numericWeight(base) ?? 400;
  const family = base
    .replace(FACE_WORDS, " ")
    .replace(/(?:variable(?:font)?|var|vf|wght|ital|opsz)/gi, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/(?:^|[-_. ])(?:[1-9]00)(?=(?:(?:italic|oblique|slanted))?(?:$|[-_. ]))/gi, " ")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    family: family || base,
    weight,
    style,
    variable: /(?:variable(?:font)?|(?:^|[-_ ])vf(?:[-_ ]|$)|\[[^\]]*wght[^\]]*\])/i.test(base),
  };
}

function comparable(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
}

export function analyzeFontFiles(files: File[]) {
  const fontFiles = files.filter(
    (file) => !file.name.startsWith("._") && file.name !== ".DS_Store",
  );
  if (fontFiles.length === 0) return { error: "Escolha pelo menos um arquivo de fonte." } as const;
  if (fontFiles.length > 12) return { error: "Envie no máximo 12 arquivos por família." } as const;
  if (fontFiles.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) {
    return { error: "A família completa deve ter no máximo 20 MB." } as const;
  }
  for (const file of fontFiles) {
    const error = validateSelectedFont(file);
    if (error) return { error: `${file.name}: ${error}` } as const;
  }

  const inferred = fontFiles.map((file) => ({ file, ...inferFontFile(file) }));
  const family = inferred[0]!.family;
  const differentFamily = inferred.some((item) => comparable(item.family) !== comparable(family));
  if (differentFamily) {
    return {
      error:
        "Os arquivos parecem pertencer a famílias diferentes. Selecione apenas os pesos e estilos da mesma família.",
    } as const;
  }
  const duplicate = inferred.some((item, index) =>
    inferred.some(
      (other, otherIndex) =>
        otherIndex < index && other.weight === item.weight && other.style === item.style,
    ),
  );
  if (duplicate) {
    return { error: "Há dois arquivos com o mesmo peso e estilo na seleção." } as const;
  }

  return {
    error: null,
    family,
    kind: fontFiles.length > 1 || inferred.some((item) => item.variable) ? "family" : "single",
    faces: inferred.map(({ file, weight, style }) => ({
      file,
      file_name: file.name,
      weight,
      style,
      preview_url: URL.createObjectURL(file),
    })),
  } as const;
}

export function normalizeFontFaces(value: unknown): BrandFontFaceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || typeof row.file_name !== "string") return [];
    const weight = Number(row.weight);
    if (!Number.isInteger(weight) || weight < 100 || weight > 900) return [];
    return [
      {
        url: row.url,
        file_name: row.file_name,
        weight,
        style: row.style === "italic" ? "italic" : "normal",
      } satisfies BrandFontFaceRecord,
    ];
  });
}

export function fontFaceLabel(face: Pick<BrandFontFaceRecord, "weight" | "style">) {
  const weights: Record<number, string> = {
    100: "Thin",
    200: "Extra Light",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "Semi Bold",
    700: "Bold",
    800: "Extra Bold",
    900: "Black",
  };
  return `${weights[face.weight] ?? face.weight}${face.style === "italic" ? " Itálico" : ""}`;
}
