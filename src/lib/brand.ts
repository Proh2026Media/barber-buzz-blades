import type { MessageKey } from "./i18n/translate.ts";

/**
 * Marca do produto num lugar só.
 *
 * Só o que é visível mora aqui. Identificadores técnicos (domínios, tabelas, chaves de
 * armazenamento "arena:*", remetentes de e-mail) continuam com os nomes antigos de propósito.
 */
export const APP_NAME = "Aurset";
export const APP_SHORT_NAME = "Aurset";

/** Descrição do produto (meta description, og:description). O texto mora no dicionário. */
export const APP_DESCRIPTION_KEY = "app.description" satisfies MessageKey;

/** Cores do navegador e do PWA (as mesmas de --bg-canvas em src/styles.css: Céu no claro, Tinta no escuro). */
export const APP_THEME_COLOR = {
  light: "#9CD8D4",
  dark: "#14221F",
  /** Fundo do ícone do app (public/icons). */
  icon: "#14221F",
} as const;

/**
 * A meta theme-color não entra no `head()` da rota: se entrasse, a hidratação recriaria a
 * versão clara ao lado da que o script já trocou. Este script é o único dono dela: garante uma
 * só (cria se faltar, remove as repetidas) e a acompanha lendo a classe `dark` do <html>, antes
 * da primeira pintura e a cada troca de tema.
 */
export const themeColorBootstrapScript = `(function () {
  try {
    var root = document.documentElement;
    function atualizar() {
      var escuro = root.classList.contains("dark");
      var cor = escuro ? ${JSON.stringify(APP_THEME_COLOR.dark)} : ${JSON.stringify(APP_THEME_COLOR.light)};
      if (root.hasAttribute("data-tema-loja")) {
        var capa = root.style.getPropertyValue("--brand-capa-navegador").trim();
        if (capa && escuro && root.getAttribute("data-tema-loja") === "claro") {
          capa = root.style.getPropertyValue("--brand-profundo").trim();
        }
        cor = capa || root.style.getPropertyValue("--brand-chao-meio").trim() || cor;
      }
      var tags = document.querySelectorAll('meta[name="theme-color"]');
      var meta = tags[0];
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      for (var i = 1; i < tags.length; i++) tags[i].remove();
      if (meta.getAttribute("content") !== cor) meta.setAttribute("content", cor);
    }
    atualizar();
    new MutationObserver(atualizar).observe(root, { attributes: true, attributeFilter: ["class","style","data-tema-loja"] });
    document.addEventListener("DOMContentLoaded", atualizar);
  } catch (e) {}
})();`;
