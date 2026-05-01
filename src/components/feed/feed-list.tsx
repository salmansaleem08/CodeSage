"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type ReactionType = "clap" | "fire" | "insight";

interface FeedItem {
  id: number;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorAvatar: string | null;
  title: string;
  description: string;
  createdAt: string;
  reactionCounts: Record<ReactionType, number>;
  viewerReactions: ReactionType[];
  comments: Array<{ id: number; body: string; userName: string; createdAt: string }>;
}

const reactionConfig: Array<{ key: ReactionType; emoji: string; label: string }> = [
  { key: "clap", emoji: "👏", label: "Clap" },
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "insight", emoji: "💡", label: "Insight" }
];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const gradients = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-rose-600"
];

function getGradient(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return gradients[code % gradients.length];
}

export function FeedList({ items, currentUserId }: { items: FeedItem[]; currentUserId: string }) {
  const [feedItems, setFeedItems] = useState(items);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient() as any, []);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function toggleReaction(eventId: number, reaction: ReactionType) {
    const key = `reaction-${eventId}-${reaction}`;
    setBusy((prev) => ({ ...prev, [key]: true }));
    const current = feedItems.find((item) => item.id === eventId);
    const hasReaction = current?.viewerReactions.includes(reaction);

    if (hasReaction) {
      await supabase.from("feed_reactions").delete().eq("event_id", eventId).eq("user_id", currentUserId).eq("reaction", reaction);
    } else {
      await supabase.from("feed_reactions").insert({
        event_id: eventId,
        user_id: currentUserId,
        reaction
      });
    }

    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.id !== eventId) return item;
        const currentlyHas = item.viewerReactions.includes(reaction);
        return {
          ...item,
          reactionCounts: {
            ...item.reactionCounts,
            [reaction]: Math.max(0, item.reactionCounts[reaction] + (currentlyHas ? -1 : 1))
          },
          viewerReactions: currentlyHas
            ? item.viewerReactions.filter((entry) => entry !== reaction)
            : [...item.viewerReactions, reaction]
        };
      })
    );
    setBusy((prev) => ({ ...prev, [key]: false }));
  }

  async function addComment(eventId: number) {
    const body = (commentDrafts[eventId] ?? "").trim();
    if (!body) return;
    const key = `comment-${eventId}`;
    setBusy((prev) => ({ ...prev, [key]: true }));
    const { data, error } = await supabase
      .from("feed_comments")
      .insert({ event_id: eventId, user_id: currentUserId, body })
      .select("id,body,created_at")
      .single();
    if (!error && data) {
      setFeedItems((prev) =>
        prev.map((item) =>
          item.id === eventId
            ? {
                ...item,
                comments: [
                  ...item.comments,
                  { id: data.id, body: data.body, createdAt: data.created_at, userName: "You" }
                ]
              }
            : item
        )
      );
      setCommentDrafts((prev) => ({ ...prev, [eventId]: "" }));
    }
    setBusy((prev) => ({ ...prev, [key]: false }));
  }

  return (
    <div className="space-y-4">
      {feedItems.map((item) => (
        <article key={item.id} className="card-hover rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          {/* Actor row */}
          <div className="mb-4 flex items-start gap-3">
            {item.actorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.actorAvatar}
                alt={item.actorName}
                className="size-10 rounded-full border border-border object-cover"
              />
            ) : (
              <div
                className={`grid size-10 shrink-0 place-content-center rounded-full bg-gradient-to-br ${getGradient(item.actorName)} text-sm font-bold text-white`}
              >
                {getInitials(item.actorName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{item.actorName}</p>
              <p className="text-xs text-muted-foreground">
                {item.actorEmail} · {timeAgo(item.createdAt)}
              </p>
            </div>
          </div>

          {/* Content */}
          <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>

          {/* Reactions */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {reactionConfig.map((reaction) => {
              const active = item.viewerReactions.includes(reaction.key);
              return (
                <button
                  key={reaction.key}
                  onClick={() => toggleReaction(item.id, reaction.key)}
                  disabled={busy[`reaction-${item.id}-${reaction.key}`]}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{item.reactionCounts[reaction.key]}</span>
                </button>
              );
            })}
          </div>

          {/* Comments */}
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <MessageCircle className="size-3.5" />
              Comments
            </div>
            <div className="space-y-2 mb-3">
              {item.comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Be the first to comment.</p>
              ) : null}
              {item.comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border bg-card px-3 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {comment.userName} · {timeAgo(comment.createdAt)}
                  </p>
                  <p className="mt-0.5 text-sm leading-snug">{comment.body}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={commentDrafts[item.id] ?? ""}
                onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                placeholder="Write a supportive comment…"
                className="h-9 text-sm"
              />
              <Button
                onClick={() => addComment(item.id)}
                className="h-9 sm:w-20"
                disabled={busy[`comment-${item.id}`]}
              >
                Send
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
