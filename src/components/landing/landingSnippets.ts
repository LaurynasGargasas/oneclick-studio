// Predefined HTML snippets the user can insert into a landing-page
// canvas.  Kept deliberately small and unopinionated — the active
// preset's family CSS takes care of styling once the snippet is in.

export interface Snippet {
  id: string;
  label: string;
  category: "Text" | "Media" | "Lists" | "CTA" | "Layout" | "Social Proof";
  html: string;
}

export const SNIPPETS: Snippet[] = [
  // ── Text ──────────────────────────────────────────────────────────
  {
    id: "headline-h2",
    label: "Section Heading",
    category: "Text",
    html: `<h2>Section Heading</h2>`,
  },
  {
    id: "headline-h3",
    label: "Subheading",
    category: "Text",
    html: `<h3>Subheading</h3>`,
  },
  {
    id: "paragraph",
    label: "Paragraph",
    category: "Text",
    html: `<p>Write your paragraph here.  Click any text to edit.</p>`,
  },
  {
    id: "pull-quote",
    label: "Pull Quote",
    category: "Text",
    html: `<blockquote style="border-left:4px solid #10b981;padding:8px 0 8px 20px;margin:24px 0;font-size:1.25em;font-style:italic;color:#1e293b;">
  "An emphatic quote that pulls the reader in."
  <footer style="margin-top:8px;font-size:0.85em;font-style:normal;color:#64748b;">— Attribution</footer>
</blockquote>`,
  },
  {
    id: "callout-warning",
    label: "Warning Callout",
    category: "Text",
    html: `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;margin:24px 0;border-radius:4px;">
  <strong style="display:block;margin-bottom:4px;color:#92400e;">⚠️ Important</strong>
  <span style="color:#78350f;">Body of the warning callout.</span>
</div>`,
  },
  {
    id: "callout-info",
    label: "Info Callout",
    category: "Text",
    html: `<div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:16px 20px;margin:24px 0;border-radius:4px;">
  <strong style="display:block;margin-bottom:4px;color:#1e40af;">ℹ️ Note</strong>
  <span style="color:#1e3a8a;">Body of the info callout.</span>
</div>`,
  },

  // ── Media ─────────────────────────────────────────────────────────
  {
    id: "image-full",
    label: "Image (full-width)",
    category: "Media",
    html: `<figure style="margin:32px 0;">
  <img src="https://placehold.co/1200x600/e5e7eb/64748b?text=Drop+an+image" alt="" style="display:block;width:100%;height:auto;border-radius:6px;" />
  <figcaption style="margin-top:8px;text-align:center;font-size:0.9em;color:#64748b;font-style:italic;">Caption goes here</figcaption>
</figure>`,
  },
  {
    id: "image-text-left",
    label: "Image + Text (image left)",
    category: "Media",
    html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;margin:32px 0;">
  <img src="https://placehold.co/600x400/e5e7eb/64748b?text=Drop+an+image" alt="" style="display:block;width:100%;height:auto;border-radius:6px;" />
  <div>
    <h3 style="margin:0 0 8px;">Heading</h3>
    <p style="margin:0;">Body text that sits beside the image.  Click to edit.</p>
  </div>
</div>`,
  },
  {
    id: "image-text-right",
    label: "Image + Text (image right)",
    category: "Media",
    html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;margin:32px 0;">
  <div>
    <h3 style="margin:0 0 8px;">Heading</h3>
    <p style="margin:0;">Body text that sits beside the image.  Click to edit.</p>
  </div>
  <img src="https://placehold.co/600x400/e5e7eb/64748b?text=Drop+an+image" alt="" style="display:block;width:100%;height:auto;border-radius:6px;" />
</div>`,
  },
  {
    id: "video-full",
    label: "Video (full-width)",
    category: "Media",
    html: `<figure style="margin:32px 0;">
  <video src="" controls muted loop playsinline style="display:block;width:100%;height:auto;border-radius:6px;background:#000;"></video>
  <figcaption style="margin-top:8px;text-align:center;font-size:0.9em;color:#64748b;font-style:italic;">Caption · drop a .mp4 onto the video to fill it</figcaption>
</figure>`,
  },

  // ── Lists ─────────────────────────────────────────────────────────
  {
    id: "bullet-list",
    label: "Bullet List",
    category: "Lists",
    html: `<ul style="margin:24px 0;padding-left:24px;line-height:1.7;">
  <li>First point</li>
  <li>Second point</li>
  <li>Third point</li>
</ul>`,
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    category: "Lists",
    html: `<ol style="margin:24px 0;padding-left:24px;line-height:1.7;">
  <li>First step</li>
  <li>Second step</li>
  <li>Third step</li>
</ol>`,
  },
  {
    id: "checklist",
    label: "Checklist (Pros)",
    category: "Lists",
    html: `<ul style="list-style:none;margin:24px 0;padding:0;line-height:1.7;">
  <li style="padding-left:28px;position:relative;"><span style="position:absolute;left:0;color:#10b981;font-weight:bold;">✓</span> Benefit one</li>
  <li style="padding-left:28px;position:relative;"><span style="position:absolute;left:0;color:#10b981;font-weight:bold;">✓</span> Benefit two</li>
  <li style="padding-left:28px;position:relative;"><span style="position:absolute;left:0;color:#10b981;font-weight:bold;">✓</span> Benefit three</li>
</ul>`,
  },

  // ── CTA ───────────────────────────────────────────────────────────
  {
    id: "cta-button",
    label: "CTA Button",
    category: "CTA",
    html: `<div style="text-align:center;margin:32px 0;">
  <a href="#" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;font-size:0.95em;">Get It Now</a>
</div>`,
  },
  {
    id: "cta-card",
    label: "CTA Card",
    category: "CTA",
    html: `<div style="background:linear-gradient(135deg,#059669,#047857);color:#fff;padding:32px;border-radius:10px;text-align:center;margin:32px 0;">
  <h3 style="color:#fff;margin:0 0 8px;font-size:1.5em;">Ready to make the switch?</h3>
  <p style="color:#d1fae5;margin:0 0 20px;">Limited-time offer — claim yours today.</p>
  <a href="#" style="display:inline-block;background:#fff;color:#047857;padding:12px 28px;border-radius:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;font-size:0.9em;">Claim My Discount</a>
</div>`,
  },
  {
    id: "guarantee-bar",
    label: "Guarantee Bar",
    category: "CTA",
    html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0;text-align:center;font-size:0.85em;color:#475569;">
  <div><strong>🛡️ 30-Day Returns</strong></div>
  <div><strong>♾️ Lifetime Warranty</strong></div>
  <div><strong>🚚 Free Shipping</strong></div>
</div>`,
  },

  // ── Layout ────────────────────────────────────────────────────────
  {
    id: "divider",
    label: "Divider",
    category: "Layout",
    html: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />`,
  },
  {
    id: "two-col-text",
    label: "Two Columns (text)",
    category: "Layout",
    html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0;">
  <div>
    <h4 style="margin:0 0 8px;">Column 1</h4>
    <p style="margin:0;">Left column body.</p>
  </div>
  <div>
    <h4 style="margin:0 0 8px;">Column 2</h4>
    <p style="margin:0;">Right column body.</p>
  </div>
</div>`,
  },
  {
    id: "three-col-text",
    label: "Three Columns",
    category: "Layout",
    html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:24px 0;">
  <div>
    <h4 style="margin:0 0 6px;">Column 1</h4>
    <p style="margin:0;font-size:0.9em;">Body.</p>
  </div>
  <div>
    <h4 style="margin:0 0 6px;">Column 2</h4>
    <p style="margin:0;font-size:0.9em;">Body.</p>
  </div>
  <div>
    <h4 style="margin:0 0 6px;">Column 3</h4>
    <p style="margin:0;font-size:0.9em;">Body.</p>
  </div>
</div>`,
  },
  {
    id: "spacer",
    label: "Spacer (40px)",
    category: "Layout",
    html: `<div style="height:40px;"></div>`,
  },

  // ── Social Proof ──────────────────────────────────────────────────
  {
    id: "star-rating",
    label: "Star Rating",
    category: "Social Proof",
    html: `<div style="display:flex;align-items:center;gap:8px;margin:16px 0;">
  <span style="color:#fbbf24;font-size:1.25em;letter-spacing:2px;">★★★★★</span>
  <span style="font-weight:bold;">4.9</span>
  <span style="color:#64748b;font-size:0.9em;">(4,889 verified reviews)</span>
</div>`,
  },
  {
    id: "testimonial-card",
    label: "Testimonial Card",
    category: "Social Proof",
    html: `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;max-width:520px;">
  <div style="color:#fbbf24;font-size:1.1em;letter-spacing:2px;margin-bottom:8px;">★★★★★</div>
  <p style="margin:0 0 16px;font-style:italic;color:#334155;line-height:1.6;">"This product completely changed how I cook.  I've recommended it to everyone in my family."</p>
  <div style="display:flex;align-items:center;gap:10px;">
    <div style="width:36px;height:36px;border-radius:50%;background:#cbd5e1;"></div>
    <div>
      <div style="font-weight:bold;font-size:0.9em;">Daniela R.</div>
      <div style="font-size:0.8em;color:#64748b;">Verified buyer · Chicago, IL</div>
    </div>
  </div>
</div>`,
  },
  {
    id: "testimonial-row",
    label: "Three Testimonials (row)",
    category: "Social Proof",
    html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:32px 0;">
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
    <div style="color:#fbbf24;margin-bottom:6px;">★★★★★</div>
    <p style="margin:0 0 10px;font-size:0.9em;font-style:italic;">"Honestly the best I've used.  Game-changer."</p>
    <div style="font-size:0.8em;font-weight:bold;">— Renata M.</div>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
    <div style="color:#fbbf24;margin-bottom:6px;">★★★★★</div>
    <p style="margin:0 0 10px;font-size:0.9em;font-style:italic;">"My kitchen has never been the same since I switched."</p>
    <div style="font-size:0.8em;font-weight:bold;">— James K.</div>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
    <div style="color:#fbbf24;margin-bottom:6px;">★★★★★</div>
    <p style="margin:0 0 10px;font-size:0.9em;font-style:italic;">"Worth every penny.  Wish I'd bought it years ago."</p>
    <div style="font-size:0.8em;font-weight:bold;">— Jane S.</div>
  </div>
</div>`,
  },
  {
    id: "social-proof-bar",
    label: "Customer Count Bar",
    category: "Social Proof",
    html: `<div style="text-align:center;padding:24px;background:#f1f5f9;border-radius:8px;margin:24px 0;">
  <div style="font-size:2em;font-weight:bold;color:#0f172a;">600,000+</div>
  <div style="color:#64748b;font-size:0.95em;margin-top:4px;">Happy customers and counting</div>
</div>`,
  },
  {
    id: "press-logos",
    label: "As Seen In (press strip)",
    category: "Social Proof",
    html: `<div style="text-align:center;margin:32px 0;">
  <div style="font-size:0.7em;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:12px;">As Seen In</div>
  <div style="display:flex;justify-content:center;align-items:center;gap:32px;flex-wrap:wrap;color:#64748b;font-weight:bold;letter-spacing:1px;">
    <span style="font-family:serif;font-size:1.1em;">FORBES</span>
    <span style="font-style:italic;font-size:1.1em;">Bloomberg</span>
    <span style="font-size:1.1em;">CNN</span>
    <span style="font-family:serif;font-size:1.1em;">NYT</span>
  </div>
</div>`,
  },

  // ── Extra CTAs ────────────────────────────────────────────────────
  {
    id: "cta-countdown",
    label: "Countdown CTA",
    category: "CTA",
    html: `<div style="background:#dc2626;color:#fff;padding:20px;text-align:center;margin:24px 0;border-radius:6px;">
  <div style="font-size:0.85em;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Limited-time offer ends in</div>
  <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:2.2em;font-weight:bold;margin:8px 0 12px;letter-spacing:4px;">03:00:00</div>
  <a href="#" style="display:inline-block;background:#fff;color:#dc2626;padding:12px 28px;border-radius:4px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;font-size:0.9em;">Claim My Discount</a>
</div>`,
  },
  {
    id: "cta-secondary",
    label: "Secondary CTA (outline)",
    category: "CTA",
    html: `<div style="text-align:center;margin:24px 0;">
  <a href="#" style="display:inline-block;border:2px solid #0f172a;color:#0f172a;padding:12px 28px;border-radius:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;font-size:0.9em;">Learn More</a>
</div>`,
  },

  // ── Extra Text ────────────────────────────────────────────────────
  {
    id: "faq-item",
    label: "FAQ Item",
    category: "Text",
    html: `<details style="border:1px solid #e2e8f0;border-radius:6px;padding:14px 18px;margin:12px 0;">
  <summary style="cursor:pointer;font-weight:bold;font-size:1.05em;color:#0f172a;">Question goes here?</summary>
  <p style="margin:12px 0 0;color:#475569;line-height:1.6;">Answer to the question.  Click to expand and edit.</p>
</details>`,
  },
  {
    id: "comparison-table",
    label: "Comparison Table",
    category: "Text",
    html: `<table style="width:100%;border-collapse:collapse;margin:32px 0;font-size:0.95em;">
  <thead>
    <tr style="background:#f1f5f9;">
      <th style="text-align:left;padding:12px 14px;border-bottom:2px solid #e2e8f0;">Feature</th>
      <th style="text-align:center;padding:12px 14px;border-bottom:2px solid #e2e8f0;background:#dcfce7;color:#166534;">Us</th>
      <th style="text-align:center;padding:12px 14px;border-bottom:2px solid #e2e8f0;">Brand B</th>
      <th style="text-align:center;padding:12px 14px;border-bottom:2px solid #e2e8f0;">Brand C</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">Non-toxic</td><td style="text-align:center;color:#16a34a;">✓</td><td style="text-align:center;color:#dc2626;">✗</td><td style="text-align:center;color:#dc2626;">✗</td></tr>
    <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">Lifetime warranty</td><td style="text-align:center;color:#16a34a;">✓</td><td style="text-align:center;color:#dc2626;">✗</td><td style="text-align:center;color:#16a34a;">✓</td></tr>
    <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">PFAS-free</td><td style="text-align:center;color:#16a34a;">✓</td><td style="text-align:center;color:#dc2626;">✗</td><td style="text-align:center;color:#dc2626;">✗</td></tr>
  </tbody>
</table>`,
  },
];

/**
 * Insert an HTML snippet at the current selection inside `canvas`.  If the
 * selection isn't in the canvas (or there is none), append at the end.
 * Returns true if the canvas was modified.
 */
export function insertSnippetIntoCanvas(
  canvas: HTMLElement,
  html: string,
): boolean {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !canvas.contains(
      selection.getRangeAt(0).commonAncestorContainer,
    )
  ) {
    canvas.insertAdjacentHTML("beforeend", html);
    return true;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const fragment = range.createContextualFragment(html);
  range.insertNode(fragment);
  // Collapse caret to end of inserted content.
  selection.collapseToEnd();
  return true;
}
