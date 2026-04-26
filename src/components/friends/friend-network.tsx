"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserCircle2 } from "lucide-react";

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

export function FriendNetwork({ currentUserId, friends, incomingRequests }: FriendNetworkProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient() as any, []);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; full_name: string; email: string; avatar_url: string | null }>>([]);
  const [status, setStatus] = useState("");

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
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .neq("id", currentUserId)
      .limit(20);
    setSearching(false);
    if (error) {
      setStatus(error.message);
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
    setStatus(`You are now friends with ${request.requesterName}.`);
    router.refresh();
  }

  async function sendRequest(targetId: string) {
    const { error } = await supabase.from("friendships").insert({
      user_id: currentUserId,
      friend_id: targetId,
      status: "pending"
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      setStatus(error.message);
      return;
    }
    setStatus("Friend request sent.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <article className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-lg font-semibold">Request Inbox</h2>
        <div className="space-y-3">
          {incomingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : null}
          {incomingRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{request.requesterName}</p>
                <p className="text-xs text-muted-foreground">{request.requesterEmail}</p>
              </div>
              <Button className="h-10" onClick={() => acceptRequest(request)}>
                Accept
              </Button>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-lg font-semibold">Search Students</h2>
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
            {searching ? "Searching..." : "Search"}
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {results.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                {student.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={student.avatar_url} alt={student.full_name} className="size-10 rounded-full border border-border object-cover" />
                ) : (
                  <div className="grid size-10 place-content-center rounded-full border border-border">
                    <UserCircle2 className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{student.full_name || student.email.split("@")[0]}</p>
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/students/${student.id}`}>
                  <Button variant="outline" className="h-10">
                    View
                  </Button>
                </Link>
                <Button className="h-10" onClick={() => sendRequest(student.id)}>
                  Request
                </Button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-lg font-semibold">Friends</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {friends.length === 0 ? <p className="text-sm text-muted-foreground">No friends added yet.</p> : null}
          {friends.map((friend) => (
            <Link
              key={friend.id}
              href={`/students/${friend.id}`}
              className="rounded-lg border border-border bg-background/70 p-4 transition-colors hover:bg-accent"
            >
              <div className="mb-2 flex items-center gap-3">
                {friend.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={friend.avatarUrl} alt={friend.name} className="size-10 rounded-full border border-border object-cover" />
                ) : (
                  <div className="grid size-10 place-content-center rounded-full border border-border">
                    <UserCircle2 className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{friend.name}</p>
                  <p className="text-xs text-muted-foreground">{friend.email}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {friend.solved} solved • rating {friend.rating}
              </p>
            </Link>
          ))}
        </div>
      </article>

      {status ? <p className="text-sm text-primary">{status}</p> : null}
    </div>
  );
}
