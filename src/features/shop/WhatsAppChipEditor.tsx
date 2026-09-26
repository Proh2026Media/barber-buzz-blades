import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WHATSAPP_TEMPLATE_VARS,
  WHATSAPP_TEMPLATE_VAR_HELP,
  type WhatsAppTemplateVar,
} from "@/lib/whatsapp/templates";
import { cn } from "@/lib/utils";

const ALLOWED = new Set<string>(WHATSAPP_TEMPLATE_VARS);
const PLACEHOLDER_RE = /\{\{([^{}]+)\}\}/g;
const CHIP_ATTR = "data-whatsapp-var";

export type WhatsAppChipEditorHandle = {
  insertVariable: (key: WhatsAppTemplateVar) => void;
  applyWrap: (wrapper: "*" | "_" | "~") => void;
  focus: () => void;
};

type WhatsAppChipEditorProps = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  "aria-label"?: string;
};

function isVarKey(value: string): value is WhatsAppTemplateVar {
  return ALLOWED.has(value);
}

function createChip(key: WhatsAppTemplateVar): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute(CHIP_ATTR, key);
  chip.contentEditable = "false";
  chip.draggable = true;
  chip.tabIndex = 0;
  chip.setAttribute("role", "button");
  chip.setAttribute("aria-label", `${WHATSAPP_TEMPLATE_VAR_HELP[key].chip}. Toque para trocar.`);
  chip.className = cn(
    "whatsapp-var-chip",
    "mx-0.5 inline-flex max-w-[9.5rem] select-none items-center truncate align-baseline",
    "rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0",
    "text-[10px] font-semibold leading-4 text-foreground",
    "cursor-grab active:cursor-grabbing",
  );
  chip.textContent = WHATSAPP_TEMPLATE_VAR_HELP[key].chip;
  return chip;
}

function serializeNode(root: HTMLElement): string {
  let out = "";

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const varKey = el.getAttribute(CHIP_ATTR);
    if (varKey && isVarKey(varKey)) {
      out += `{{${varKey}}}`;
      return;
    }
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    const isBlock = /^(DIV|P|LI)$/i.test(el.tagName);
    if (isBlock && out.length > 0 && !out.endsWith("\n")) {
      out += "\n";
    }
    for (const child of Array.from(el.childNodes)) walk(child);
    if (isBlock && !out.endsWith("\n")) {
      out += "\n";
    }
  };

  for (const child of Array.from(root.childNodes)) walk(child);
  return out.replace(/\n+$/, (m) => (m.length > 1 ? "\n" : ""));
}

function fillEditor(root: HTMLElement, value: string) {
  root.replaceChildren();
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) {
    root.appendChild(document.createTextNode(""));
    return;
  }

  const parts = normalized.split(PLACEHOLDER_RE);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? "";
    if (i % 2 === 1) {
      if (isVarKey(part)) {
        root.appendChild(createChip(part));
      } else {
        root.appendChild(document.createTextNode(`{{${part}}}`));
      }
      continue;
    }
    if (!part) continue;
    const lines = part.split("\n");
    lines.forEach((line, lineIndex) => {
      if (line) root.appendChild(document.createTextNode(line));
      if (lineIndex < lines.length - 1) {
        root.appendChild(document.createElement("br"));
      }
    });
  }
}

function placeCaretAfter(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEnd(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function caretRangeFromPoint(x: number, y: number): Range | null {
  if (typeof document.caretRangeFromPoint === "function") {
    return document.caretRangeFromPoint(x, y);
  }
  const doc = document as Document & {
    caretPositionFromPoint?: (
      clientX: number,
      clientY: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

function insertNodeAtCaret(root: HTMLElement, node: Node) {
  root.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
    root.appendChild(node);
    placeCaretAfter(node);
    return;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  placeCaretAfter(node);
}

export const WhatsAppChipEditor = forwardRef<WhatsAppChipEditorHandle, WhatsAppChipEditorProps>(
  function WhatsAppChipEditor({ value, onChange, className, "aria-label": ariaLabel }, ref) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef(value);
    const draggingChipRef = useRef<HTMLSpanElement | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuKey, setMenuKey] = useState<WhatsAppTemplateVar>("loja");
    const [menuChip, setMenuChip] = useState<HTMLSpanElement | null>(null);
    const [anchorPos, setAnchorPos] = useState({ x: 0, y: 0 });

    const emitChange = useCallback(() => {
      const root = editorRef.current;
      if (!root) return;
      const next = serializeNode(root);
      lastValueRef.current = next;
      onChange(next);
    }, [onChange]);

    useEffect(() => {
      const root = editorRef.current;
      if (!root) return;
      if (value === lastValueRef.current && root.childNodes.length > 0) return;
      fillEditor(root, value);
      lastValueRef.current = value;
    }, [value]);

    useImperativeHandle(ref, () => ({
      insertVariable(key) {
        const root = editorRef.current;
        if (!root) return;
        const chip = createChip(key);
        insertNodeAtCaret(root, chip);
        emitChange();
      },
      applyWrap(wrapper) {
        const root = editorRef.current;
        if (!root) return;
        root.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return;
        const selected = range.toString();
        const text = document.createTextNode(`${wrapper}${selected || "texto"}${wrapper}`);
        range.deleteContents();
        range.insertNode(text);
        placeCaretAfter(text);
        emitChange();
      },
      focus() {
        editorRef.current?.focus();
      },
    }));

    function openChipMenu(chip: HTMLSpanElement) {
      const key = chip.getAttribute(CHIP_ATTR);
      if (!key || !isVarKey(key)) return;
      const rect = chip.getBoundingClientRect();
      setMenuKey(key);
      setMenuChip(chip);
      setAnchorPos({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
      setMenuOpen(true);
    }

    function replaceChipVar(nextKey: WhatsAppTemplateVar) {
      if (!menuChip || !menuChip.isConnected) return;
      const replacement = createChip(nextKey);
      menuChip.replaceWith(replacement);
      setMenuChip(replacement);
      setMenuKey(nextKey);
      setMenuOpen(false);
      placeCaretAfter(replacement);
      emitChange();
    }

    function removeChip() {
      const root = editorRef.current;
      if (!menuChip || !menuChip.isConnected || !root) return;
      menuChip.remove();
      setMenuOpen(false);
      setMenuChip(null);
      placeCaretAtEnd(root);
      root.focus();
      emitChange();
    }

    return (
      <>
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel ?? "Texto da mensagem"}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          className={cn(
            "min-h-[12rem] w-full resize-y overflow-auto rounded-xl border border-border bg-background px-3 py-2",
            "text-sm leading-relaxed whitespace-pre-wrap break-words outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
          onInput={() => emitChange()}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            // Mantém quebra simples (como WhatsApp), sem criar <div>.
            event.preventDefault();
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const br = document.createElement("br");
            range.insertNode(br);
            // Garante caret após o BR (Safari/Chrome).
            const spacer = document.createTextNode("");
            br.after(spacer);
            placeCaretAfter(br);
            emitChange();
          }}
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const chip = target.closest(`[${CHIP_ATTR}]`);
            if (!(chip instanceof HTMLSpanElement) || !editorRef.current?.contains(chip)) return;
            event.preventDefault();
            event.stopPropagation();
            openChipMenu(chip);
          }}
          onDragStart={(event) => {
            const target = event.target;
            if (!(target instanceof HTMLSpanElement) || !target.hasAttribute(CHIP_ATTR)) return;
            draggingChipRef.current = target;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", target.getAttribute(CHIP_ATTR) ?? "");
          }}
          onDragOver={(event) => {
            if (!draggingChipRef.current) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            const root = editorRef.current;
            const chip = draggingChipRef.current;
            if (!root || !chip) return;
            event.preventDefault();
            draggingChipRef.current = null;

            const rangeFromPoint = caretRangeFromPoint(event.clientX, event.clientY);
            if (!rangeFromPoint || !root.contains(rangeFromPoint.startContainer)) {
              root.appendChild(chip);
            } else {
              // Evita soltar dentro de outra pílula.
              const startEl =
                rangeFromPoint.startContainer.nodeType === Node.ELEMENT_NODE
                  ? (rangeFromPoint.startContainer as HTMLElement)
                  : rangeFromPoint.startContainer.parentElement;
              if (startEl?.closest(`[${CHIP_ATTR}]`)) {
                const host = startEl.closest(`[${CHIP_ATTR}]`);
                host?.after(chip);
              } else {
                rangeFromPoint.insertNode(chip);
              }
            }
            placeCaretAfter(chip);
            emitChange();
          }}
          onDragEnd={() => {
            draggingChipRef.current = null;
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            if (!text) return;
            const root = editorRef.current;
            if (!root) return;
            // Cola texto puro; variáveis literais viram pílulas no próximo sync externo se necessário.
            // Inserção imediata parseando placeholders.
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const frag = document.createDocumentFragment();
            const temp = document.createElement("div");
            fillEditor(temp, text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
            while (temp.firstChild) frag.appendChild(temp.firstChild);
            range.insertNode(frag);
            emitChange();
          }}
        />

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none fixed h-px w-px opacity-0"
              style={{ left: anchorPos.x, top: anchorPos.y }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[11rem] rounded-xl">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Trocar dado
            </DropdownMenuLabel>
            {WHATSAPP_TEMPLATE_VARS.map((key) => (
              <DropdownMenuItem
                key={key}
                className="rounded-lg text-sm"
                onSelect={() => replaceChipVar(key)}
              >
                <span className={cn(key === menuKey && "font-bold")}>
                  {WHATSAPP_TEMPLATE_VAR_HELP[key].chip}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-lg text-sm text-destructive focus:text-destructive"
              onSelect={removeChip}
            >
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  },
);
