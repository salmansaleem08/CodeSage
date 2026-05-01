"use client";

import { useState, useEffect } from "react";

const QUOTES = [
  "Struggle is where thinking begins.",
  "Every bug you solve sharpens your intuition.",
  "Logic grows one attempt at a time.",
  "Consistency beats intensity in coding.",
  "You are building patterns, not just programs.",
  "Each failed run is feedback, not failure.",
  "Clarity comes from breaking problems down.",
  "Strong fundamentals create fast progress.",
  "Persist through confusion and insight follows.",
  "Progress is proof of deliberate practice."
];

function getNextQuote(): string {
  const orderKey = "codesage-quote-order";
  const indexKey = "codesage-quote-index";

  const savedOrder = window.localStorage.getItem(orderKey);
  const savedIndex = window.localStorage.getItem(indexKey);

  let order = savedOrder ? (JSON.parse(savedOrder) as number[]) : [];
  let index = savedIndex ? Number(savedIndex) : 0;

  if (order.length !== QUOTES.length || index >= order.length || Number.isNaN(index)) {
    order = QUOTES.map((_, i) => i).sort(() => Math.random() - 0.5);
    index = 0;
  }

  const quote = QUOTES[order[index]];
  index += 1;

  if (index >= order.length) {
    order = QUOTES.map((_, i) => i).sort(() => Math.random() - 0.5);
    index = 0;
  }

  window.localStorage.setItem(orderKey, JSON.stringify(order));
  window.localStorage.setItem(indexKey, String(index));

  return quote;
}

export function MotivationQuote() {
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    setQuote(getNextQuote());
  }, []);

  // Render nothing until mounted to avoid hydration mismatch
  if (!quote) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_color-mix(in_oklab,var(--primary)_18%,transparent),transparent_55%),radial-gradient(circle_at_bottom_left,_color-mix(in_oklab,var(--secondary)_20%,transparent),transparent_55%)]" />
      <div className="relative">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary uppercase">Daily Motivation</p>
        <p className="max-w-3xl text-lg leading-relaxed font-medium text-foreground md:text-xl">&ldquo;{quote}&rdquo;</p>
      </div>
    </section>
  );
}
