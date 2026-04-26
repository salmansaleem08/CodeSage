"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface StudentRequestButtonProps {
  currentUserId: string;
  targetUserId: string;
  existingStatus: "none" | "pending_sent" | "pending_received" | "accepted";
}

export function StudentRequestButton({ currentUserId, targetUserId, existingStatus }: StudentRequestButtonProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient() as any, []);
  const [status, setStatus] = useState(existingStatus);
  const [loading, setLoading] = useState(false);

  async function sendRequest() {
    setLoading(true);
    const { error } = await supabase.from("friendships").insert({
      user_id: currentUserId,
      friend_id: targetUserId,
      status: "pending"
    });
    setLoading(false);
    if (error && !error.message.toLowerCase().includes("duplicate")) return;
    setStatus("pending_sent");
    router.refresh();
  }

  async function acceptRequest() {
    setLoading(true);
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("user_id", targetUserId)
      .eq("friend_id", currentUserId)
      .eq("status", "pending");
    setLoading(false);
    setStatus("accepted");
    router.refresh();
  }

  if (status === "accepted") {
    return (
      <Button className="h-11" disabled>
        Friends
      </Button>
    );
  }

  if (status === "pending_sent") {
    return (
      <Button variant="outline" className="h-11" disabled>
        Request Sent
      </Button>
    );
  }

  if (status === "pending_received") {
    return (
      <Button className="h-11" onClick={acceptRequest} disabled={loading}>
        {loading ? "Accepting..." : "Accept Request"}
      </Button>
    );
  }

  return (
    <Button className="h-11" onClick={sendRequest} disabled={loading}>
      {loading ? "Sending..." : "Send Friend Request"}
    </Button>
  );
}
