/**
 * Runs in each document via BrowserContext.addInitScript(). Keep self-contained.
 *
 * WebKit queues autofocus on insertion, without rechecking the attribute later.
 * Make candidates unfocusable until flushAutofocusCandidates has discarded them.
 * Page::updateRendering flushes autofocus BEFORE animation-frame callbacks; a
 * parser waiting for stylesheets can defer that flush, so wait for the top
 * document's DOMContentLoaded first. This intentionally suppresses document
 * autofocus, rather than replacing Playwright's focus/selection/input behavior.
 *
 * See docs/webkit-autofocus.md for scope and tradeoffs.
 *
 * Install only in WebKit contexts, before pages navigate:
 * `await context.addInitScript(suppressWebKitAutofocus)`.
 */
export function suppressWebKitAutofocus(): void {
  let topDocument: Document;
  try {
    topDocument = window.top!.document;
  } catch {
    // WebKit already rejects native autofocus candidates in cross-origin frames.
    return;
  }

  const pending = new Map<
    HTMLElement,
    {
      property: "visibility" | "display";
      temporary: "hidden" | "none";
      value: string;
      priority: string;
      hadStyle: boolean;
    }
  >();
  const candidates = new WeakSet<Element>();
  let scheduled = false;

  function restoreAfterFlush(): void {
    requestAnimationFrame(() => {
      scheduled = false;
      for (const [element, original] of pending) {
        if (
          element.style.getPropertyValue(original.property) ===
            original.temporary &&
          element.style.getPropertyPriority(original.property) === "important"
        ) {
          if (original.value) {
            element.style.setProperty(
              original.property,
              original.value,
              original.priority,
            );
          } else {
            element.style.removeProperty(original.property);
          }
          // Synchronize WebKit's serialized style attribute before removing it.
          if (!original.hadStyle && !element.getAttribute("style")) {
            element.removeAttribute("style");
          }
        }
      }
      pending.clear();
    });
  }

  function quarantine(element: Element): void {
    if (element.namespaceURI !== "http://www.w3.org/1999/xhtml") return;
    // Remember detached candidates too: the parser may still be blocking their
    // queued opportunity when they are reinserted without the attribute.
    candidates.add(element);
    if (!element.isConnected) return;
    const candidate = element as HTMLElement;
    if (!pending.has(candidate)) {
      // Keep normal form controls in layout. Hide other candidates' subtrees
      // entirely, including hosts whose shadow roots might delegate focus.
      const isControl = /^(input|textarea|select|button)$/.test(
        candidate.localName,
      );
      const property = isControl ? "visibility" : "display";
      const temporary = isControl ? "hidden" : "none";
      // Capture attribute presence before changing its CSSStyleDeclaration.
      const hadStyle = candidate.hasAttribute("style");
      pending.set(candidate, {
        property,
        temporary,
        value: candidate.style.getPropertyValue(property),
        priority: candidate.style.getPropertyPriority(property),
        hadStyle,
      });
      candidate.style.setProperty(property, temporary, "important");
    }
    if (scheduled) return;
    scheduled = true;
    if (topDocument.readyState === "loading") {
      topDocument.addEventListener("DOMContentLoaded", restoreAfterFlush, {
        once: true,
      });
    } else {
      restoreAfterFlush();
    }
  }

  function scan(node: Node): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.hasAttribute("autofocus") || candidates.has(element))
      quarantine(element);
    element.querySelectorAll("*").forEach((descendant) => {
      if (descendant.hasAttribute("autofocus") || candidates.has(descendant))
        quarantine(descendant);
    });
  }

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach(scan);
      } else if (record.attributeName === "style") {
        const element = record.target as HTMLElement;
        const original = pending.get(element);
        if (
          original &&
          (element.style.getPropertyValue(original.property) !==
            original.temporary ||
            element.style.getPropertyPriority(original.property) !==
              "important")
        ) {
          // Keep the candidate hidden through the flush even if application
          // code changes its styles in the meantime. Restore the latest value.
          original.value = element.style.getPropertyValue(original.property);
          original.priority = element.style.getPropertyPriority(
            original.property,
          );
          original.hadStyle = element.hasAttribute("style");
          element.style.setProperty(
            original.property,
            original.temporary,
            "important",
          );
        }
      } else {
        // Also catch an attribute removed synchronously after insertion, before
        // observer delivery: its native candidate is still in WebKit's queue.
        quarantine(record.target as Element);
      }
    }
  }).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["autofocus", "style"],
  });
  document.querySelectorAll("[autofocus]").forEach(quarantine);
}
