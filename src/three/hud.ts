/**
 * DOM-overlay HUD for the 3D prototype — token counter, controls hint,
 * and the level-complete card. Storybook palette, no framework.
 */
export class Hud {
  private root: HTMLDivElement;
  private tokenLabel: HTMLDivElement;
  private progressLabel: HTMLDivElement;
  private hint: HTMLDivElement;
  private winCard: HTMLDivElement | null = null;
  private heartsLabel: HTMLDivElement;
  private caption: HTMLDivElement;
  /** DOM timer id from window.setTimeout; null = no caption fade pending. */
  private captionTimer: number | null = null;
  private total = 0;
  private winTitle: string;
  private nextLabel: string;

  constructor(
    private onReplay: () => void,
    private onNext: (() => void) | null = null,
    opts: { winTitle?: string; nextLabel?: string } = {},
  ) {
    this.winTitle = opts.winTitle ?? "Level Complete!";
    this.nextLabel = opts.nextLabel ?? "Next level →";
    this.root = document.createElement("div");
    this.root.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "font-family:ui-rounded, 'SF Pro Rounded', 'Comic Sans MS', system-ui, sans-serif",
      "z-index:10",
    ].join(";");

    this.tokenLabel = document.createElement("div");
    this.tokenLabel.style.cssText = [
      "position:absolute",
      "top:18px",
      "left:22px",
      "padding:10px 18px",
      "background:rgba(255, 250, 240, 0.85)",
      "border:2px solid #b8804a",
      "border-radius:18px",
      "color:#6b4a2f",
      "font-size:22px",
      "font-weight:700",
      "box-shadow:0 3px 10px rgba(107, 74, 47, 0.25)",
    ].join(";");
    this.root.appendChild(this.tokenLabel);

    // World progress ("Bedroom · 2 / 5") — the continuous-world progression cue.
    this.progressLabel = document.createElement("div");
    this.progressLabel.style.cssText = [
      "position:absolute",
      "top:78px",
      "left:22px",
      "padding:6px 14px",
      "background:rgba(255, 250, 240, 0.72)",
      "border:2px solid rgba(184, 128, 74, 0.55)",
      "border-radius:14px",
      "color:#6b4a2f",
      "font-size:16px",
      "font-weight:700",
    ].join(";");
    this.progressLabel.style.display = "none";
    this.root.appendChild(this.progressLabel);

    // Hearts row (top-right).
    this.heartsLabel = document.createElement("div");
    this.heartsLabel.style.cssText = [
      "position:absolute",
      "top:18px",
      "right:22px",
      "padding:10px 16px",
      "background:rgba(255, 250, 240, 0.85)",
      "border:2px solid #b8804a",
      "border-radius:18px",
      "font-size:22px",
      "letter-spacing:2px",
      "box-shadow:0 3px 10px rgba(107, 74, 47, 0.25)",
    ].join(";");
    this.heartsLabel.textContent = "❤️❤️❤️";
    this.root.appendChild(this.heartsLabel);

    // Transient caption ("You met Teddy!").
    this.caption = document.createElement("div");
    this.caption.style.cssText = [
      "position:absolute",
      "top:22%",
      "left:50%",
      "transform:translateX(-50%)",
      "padding:12px 28px",
      "background:rgba(107, 74, 47, 0.9)",
      "color:#fff4e0",
      "border-radius:18px",
      "font-size:24px",
      "font-weight:800",
      "opacity:0",
      "transition:opacity 0.3s ease",
    ].join(";");
    this.root.appendChild(this.caption);

    this.hint = document.createElement("div");
    this.hint.textContent = "← → / D-pad: move · Space / Ⓐ: jump";
    this.hint.style.cssText = [
      "position:absolute",
      "bottom:26px",
      "left:50%",
      "transform:translateX(-50%)",
      "padding:8px 20px",
      "background:rgba(107, 74, 47, 0.75)",
      "color:#fff4e0",
      "border-radius:16px",
      "font-size:17px",
      "transition:opacity 1.2s ease",
    ].join(";");
    this.root.appendChild(this.hint);
    window.setTimeout(() => {
      this.hint.style.opacity = "0";
    }, 7000);

    document.body.appendChild(this.root);
  }

  setTokens(collected: number, total: number): void {
    this.total = total;
    this.tokenLabel.textContent = `⭐ ${collected} / ${total}`;
  }

  setProgress(text: string): void {
    this.progressLabel.textContent = text;
    this.progressLabel.style.display = text ? "block" : "none";
  }

  showWin(collected: number): void {
    if (this.winCard) return;
    const card = document.createElement("div");
    card.style.cssText = [
      "position:absolute",
      "top:50%",
      "left:50%",
      "transform:translate(-50%, -50%)",
      "padding:38px 56px",
      "background:rgba(255, 250, 240, 0.96)",
      "border:3px solid #b8804a",
      "border-radius:28px",
      "text-align:center",
      "color:#6b4a2f",
      "box-shadow:0 12px 40px rgba(107, 74, 47, 0.35)",
      "pointer-events:auto",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = this.winTitle;
    title.style.cssText = "font-size:38px;font-weight:800;margin-bottom:10px";
    const stars = document.createElement("div");
    stars.textContent = `⭐ ${collected} / ${this.total} stars`;
    stars.style.cssText = "font-size:24px;margin-bottom:24px";
    const button = document.createElement("button");
    button.textContent = "Play again";
    button.style.cssText = [
      "font-family:inherit",
      "font-size:20px",
      "font-weight:700",
      "padding:12px 32px",
      "border-radius:16px",
      "border:none",
      "cursor:pointer",
      "background:#b8804a",
      "color:#fff4e0",
    ].join(";");
    button.addEventListener("click", () => {
      this.hideWin();
      this.onReplay();
    });

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:14px;justify-content:center";
    row.appendChild(button);
    if (this.onNext) {
      const next = document.createElement("button");
      next.textContent = this.nextLabel;
      next.style.cssText = button.style.cssText + ";background:#6b8f5a";
      next.addEventListener("click", () => this.onNext!());
      row.appendChild(next);
    }

    card.append(title, stars, row);
    this.root.appendChild(card);
    this.winCard = card;
  }

  hideWin(): void {
    this.winCard?.remove();
    this.winCard = null;
  }

  setHearts(current: number, max: number): void {
    const safe = Math.max(0, current);
    this.heartsLabel.textContent = "❤️".repeat(safe) + "🤍".repeat(Math.max(0, max - safe));
  }

  showCaption(text: string, ms = 2200): void {
    this.caption.textContent = text;
    this.caption.style.opacity = "1";
    if (this.captionTimer !== null) window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => {
      this.caption.style.opacity = "0";
    }, ms);
  }
}
