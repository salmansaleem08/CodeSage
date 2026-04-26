"use client";

import { useMemo, useState } from "react";
import { Flame, Lightbulb, MessageCircle, Sparkles } from "lucide-react";

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
    <div className="space-y-5">
      {feedItems.map((item) => (
        <article key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-start gap-3">
            {item.actorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.actorAvatar} alt={item.actorName} className="size-11 rounded-full border border-border object-cover" />
            ) : (
              <div className="grid size-11 place-content-center rounded-full border border-border bg-background text-sm font-semibold text-muted-foreground">
                {item.actorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">{item.actorName}</p>
              <p className="text-xs text-muted-foreground">
                {item.actorEmail} • {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: "clap" as const, label: "Clap", icon: Sparkles },
              { key: "fire" as const, label: "Fire", icon: Flame },
              { key: "insight" as const, label: "Insight", icon: Lightbulb }
            ].map((reaction) => {
              const Icon = reaction.icon;
              const active = item.viewerReactions.includes(reaction.key);
              return (
                <Button
                  key={reaction.key}
                  variant={active ? "secondary" : "outline"}
                  className="h-9"
                  onClick={() => toggleReaction(item.id, reaction.key)}
                  disabled={busy[`reaction-${item.id}-${reaction.key}`]}
                >
                  <Icon className="size-4" />
                  {reaction.label} ({item.reactionCounts[reaction.key]})
                </Button>
              );
            })}
          </div>

          <div className="mt-5 space-y-3 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="size-4 text-primary" />
              Comments
            </div>
            <div className="space-y-2">
              {item.comments.length === 0 ? <p className="text-sm text-muted-foreground">Be the first to comment.</p> : null}
              {item.comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {comment.userName} • {new Date(comment.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm">{comment.body}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={commentDrafts[item.id] ?? ""}
                onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                placeholder="Write a supportive comment..."
                className="h-10"
              />
              <Button onClick={() => addComment(item.id)} className="h-10 sm:w-24" disabled={busy[`comment-${item.id}`]}>
                Send
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
