"use client";

import { useMemo } from "react";

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

function getCurrentQuote(): string {
  if (typeof window === "undefined") return QUOTES[0];

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
  const quote = useMemo(() => getCurrentQuote(), []);

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="mb-2 text-sm font-medium text-primary">Motivation</p>
      <p className="text-base text-foreground">&ldquo;{quote}&rdquo;</p>
    </section>
  );
}
