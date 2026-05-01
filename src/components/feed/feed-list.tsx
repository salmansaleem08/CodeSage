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

const avatarColors = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
];

function getAvatarColor(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return avatarColors[code % avatarColors.length];
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
    <div className="divide-y divide-border">
      {feedItems.map((item) => (
        <article key={item.id} className="py-5">
          {/* Actor row */}
          <div className="flex items-center gap-3">
            {item.actorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.actorAvatar}
                alt={item.actorName}
                className="size-8 rounded-full object-cover"
              />
            ) : (
              <div
                className={`grid size-8 shrink-0 place-content-center rounded-full text-xs font-semibold ${getAvatarColor(item.actorName)}`}
              >
                {getInitials(item.actorName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{item.actorName}</p>
              <p className="text-[11px] text-muted-foreground">{timeAgo(item.createdAt)}</p>
            </div>
          </div>

          {/* Content */}
          <div className="mt-3">
            <p className="text-sm font-medium leading-snug">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>

          {/* Reactions — minimal chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {reactionConfig.map((reaction) => {
              const active = item.viewerReactions.includes(reaction.key);
              return (
                <button
                  key={reaction.key}
                  onClick={() => toggleReaction(item.id, reaction.key)}
                  disabled={busy[`reaction-${item.id}-${reaction.key}`]}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-50 ${
                    active
                      ? "border-primary/30 bg-primary/8 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="text-[11px]">{reaction.emoji}</span>
                  <span className="tabular-nums">{item.reactionCounts[reaction.key]}</span>
                </button>
              );
            })}
          </div>

          {/* Comments — inline, minimal */}
          <div className="mt-3 border-t border-border pt-3">
            {item.comments.length > 0 && (
              <div className="mb-3 space-y-2.5">
                {item.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 text-sm">
                    <span className="shrink-0 font-medium text-foreground/80">{comment.userName}</span>
                    <span className="text-muted-foreground">{comment.body}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground/60">{timeAgo(comment.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <MessageCircle className="size-3.5 shrink-0 text-muted-foreground/50" />
              <Input
                value={commentDrafts[item.id] ?? ""}
                onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                placeholder={item.comments.length === 0 ? "Add a comment…" : "Reply…"}
                className="h-8 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addComment(item.id)}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={busy[`comment-${item.id}`]}
              >
                Post
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
