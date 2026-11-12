import { invoke, isTauri } from "@tauri-apps/api/core";

export function printWithClass(className: string, selector: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cleaned = false;
    let settled = false;
    let timeoutId = 0;
    const printRoot = document.createElement("main");
    printRoot.id = "print-document-root";
    printRoot.className = `print-document-root ${className}-root`;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove(className);
      printRoot.remove();
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const handleAfterPrint = () => {
      cleanup();
      finish();
    };

    const source = document.querySelector<HTMLElement>(selector);
    if (!source) {
      reject(
        new Error(
          "The document could not be prepared for printing. Close this message and try again.",
        ),
      );
      return;
    }

    printRoot.append(source.cloneNode(true));
    document.body.append(printRoot);

    document.body.classList.add(className);
    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      finish();
    }, 5 * 60 * 1000);
    window.dispatchEvent(new Event("resize"));

    void (async () => {
      await new Promise<void>((done) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => done()));
      });

      if (isTauri()) {
        await invoke<void>("print_current_window");
        finish();
      } else {
        window.print();
        cleanup();
        finish();
      }
    })().catch((error: unknown) => {
      cleanup();
      if (settled) return;
      settled = true;
      reject(
        new Error(
          error instanceof Error
            ? error.message
            : typeof error === "string" && error.trim()
              ? error
              : "The system could not open the print dialog. Check that a printer is available and try again.",
        ),
      );
    });
  });
}
