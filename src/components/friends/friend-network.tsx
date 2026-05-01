"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, Trophy, UserPlus, Users, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface Friend {
  id: string;
  name: string;
  email: string;
  solved: number;
  rating: number;
  avatarUrl: string | null;
}

interface IncomingRequest {
  id: number;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
}

interface FriendNetworkProps {
  currentUserId: string;
  friends: Friend[];
  incomingRequests: IncomingRequest[];
}

type StatusKind = "success" | "error" | "";

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function FriendNetwork({ currentUserId, friends, incomingRequests }: FriendNetworkProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient() as any, []);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; full_name: string; email: string; avatar_url: string | null }>>([]);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("");

  function showStatus(message: string, kind: StatusKind) {
    setStatus(message);
    setStatusKind(kind);
  }

  async function searchUsers() {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,avatar_url")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,bio.ilike.%${term}%,degree.ilike.%${term}%`)
      .neq("id", currentUserId)
      .limit(20);
    setSearching(false);
    if (error) {
      showStatus(error.message, "error");
      return;
    }
    setResults(data ?? []);
  }

  async function acceptRequest(request: IncomingRequest) {
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("user_id", request.requesterId)
      .eq("friend_id", currentUserId)
      .eq("status", "pending");
    showStatus(`You are now friends with ${request.requesterName}.`, "success");
    router.refresh();
  }

  async function sendRequest(targetId: string) {
    const { error } = await supabase.from("friendships").insert({
      user_id: currentUserId,
      friend_id: targetId,
      status: "pending"
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      showStatus(error.message, "error");
      return;
    }
    showStatus("Friend request sent.", "success");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Request Inbox */}
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Request Inbox</h2>
        </div>
        <div className="space-y-3">
          {incomingRequests.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4">
              <UserPlus className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No pending requests right now.</p>
            </div>
          ) : null}
          {incomingRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{request.requesterName}</p>
                <p className="text-xs text-muted-foreground">{request.requesterEmail}</p>
              </div>
              <Button className="h-9 text-sm" onClick={() => acceptRequest(request)}>
                Accept
              </Button>
            </div>
          ))}
        </div>
      </article>

      {/* Search Students */}
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Search className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Search Students</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or email"
              className="h-11 pl-9"
            />
          </div>
          <Button className="h-11 sm:w-32" onClick={searchUsers} disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {results.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                {student.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={student.avatar_url}
                    alt={student.full_name}
                    className="size-10 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div
                    className={`grid size-10 shrink-0 place-content-center rounded-full bg-gradient-to-br ${getGradient(student.full_name || student.email)} text-sm font-bold text-white`}
                  >
                    {getInitials(student.full_name || student.email.split("@")[0])}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{student.full_name || student.email.split("@")[0]}</p>
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/students/${student.id}`}>
                  <Button variant="outline" className="h-9 text-sm">
                    View
                  </Button>
                </Link>
                <Button className="h-9 text-sm" onClick={() => sendRequest(student.id)}>
                  Request
                </Button>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* Friends List */}
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Friends</h2>
          {friends.length > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {friends.length}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {friends.length === 0 ? (
            <div className="col-span-2 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4">
              <Users className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No friends added yet. Use Search above to connect.</p>
            </div>
          ) : null}
          {friends.map((friend) => (
            <Link
              key={friend.id}
              href={`/students/${friend.id}`}
              className="card-hover rounded-xl border border-border bg-background/70 p-4 transition-colors hover:bg-accent"
            >
              <div className="mb-3 flex items-center gap-3">
                {friend.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={friend.avatarUrl}
                    alt={friend.name}
                    className="size-10 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div
                    className={`grid size-10 shrink-0 place-content-center rounded-full bg-gradient-to-br ${getGradient(friend.name)} text-sm font-bold text-white`}
                  >
                    {getInitials(friend.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{friend.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{friend.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trophy className="size-3.5 text-primary/70" />
                <span>{friend.solved} solved</span>
              </div>
            </Link>
          ))}
        </div>
      </article>

      {/* Status banner */}
      {status ? (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
            statusKind === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800/40 dark:bg-green-950/30 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300"
          }`}
        >
          {statusKind === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <XCircle className="size-4 shrink-0" />
          )}
          {status}
        </div>
      ) : null}
    </div>
  );
}
