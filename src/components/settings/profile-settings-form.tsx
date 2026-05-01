"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, UserCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface ProfileSettingsFormProps {
  userId: string;
  initialProfile: {
    full_name: string;
    email: string;
    bio: string;
    degree: string;
    interests: string[];
    avatar_url: string | null;
    default_mode: "SEED" | "FOCUS" | "SHADOW";
    default_hint_level: number;
    code_preference: string;
  };
}

type FriendLookup = { id: string };

type StatusKind = "success" | "error" | "";

export function ProfileSettingsForm({ userId, initialProfile }: ProfileSettingsFormProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const [fullName, setFullName] = useState(initialProfile.full_name);
  const [bio, setBio] = useState(initialProfile.bio);
  const [degree, setDegree] = useState(initialProfile.degree);
  const [interests, setInterests] = useState(initialProfile.interests.join(", "));
  const [defaultMode, setDefaultMode] = useState(initialProfile.default_mode);
  const [defaultHintLevel, setDefaultHintLevel] = useState(initialProfile.default_hint_level);
  const [codePreference, setCodePreference] = useState(initialProfile.code_preference);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url);
  const [friendEmail, setFriendEmail] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function showStatus(message: string, kind: StatusKind) {
    setStatus(message);
    setStatusKind(kind);
  }

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    const extension = file.name.split(".").pop() ?? "jpg";
    const filePath = `${userId}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) {
      showStatus(uploadError.message, "error");
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl
      })
      .eq("id", userId);

    if (updateError) {
      showStatus(updateError.message, "error");
      setUploading(false);
      return;
    }

    setAvatarUrl(publicUrl);
    setUploading(false);
    showStatus("Profile photo updated.", "success");
    router.refresh();
  }

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setStatusKind("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        bio: bio.trim(),
        degree: degree.trim(),
        interests: interests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        default_mode: defaultMode,
        default_hint_level: defaultHintLevel,
        code_preference: codePreference.trim()
      })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      showStatus(error.message, "error");
      return;
    }

    showStatus("Profile settings saved.", "success");
    router.refresh();
  }

  async function handleAddFriend(event: React.FormEvent) {
    event.preventDefault();
    setStatus("");
    setStatusKind("");

    const normalized = friendEmail.trim().toLowerCase();
    if (!normalized) return;

    const { data: friendProfileData, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    const friendProfile = friendProfileData as FriendLookup | null;

    if (profileError || !friendProfile) {
      showStatus("Friend account not found.", "error");
      return;
    }

    if (friendProfile.id === userId) {
      showStatus("You cannot add yourself.", "error");
      return;
    }

    const { error: insertError } = await supabase.from("friendships").insert({
      user_id: userId,
      friend_id: friendProfile.id,
      status: "pending"
    });

    if (insertError && !insertError.message.includes("duplicate")) {
      showStatus(insertError.message, "error");
      return;
    }

    setFriendEmail("");
    showStatus("Friend request sent.", "success");
    router.refresh();
  }

  const selectClass =
    "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-5">
      {/* Avatar section */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-base font-semibold">Profile Image</h2>
        <p className="mb-5 text-sm text-muted-foreground">Update your profile photo.</p>
        <div className="flex items-center gap-5">
          <label className="group relative cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleAvatarUpload(file);
              }}
            />
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="size-20 rounded-full border border-border object-cover transition-opacity group-hover:opacity-80"
              />
            ) : (
              <div className="grid size-20 place-content-center rounded-full border border-border bg-muted transition-colors group-hover:bg-accent">
                <UserCircle2 className="size-9 text-muted-foreground" />
              </div>
            )}
            <span className="absolute -right-1 -bottom-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold shadow-xs">
              Edit
            </span>
          </label>
          <div className="space-y-1">
            <p className="text-sm font-medium">Click to change photo</p>
            <p className="text-xs text-muted-foreground">{uploading ? "Uploading…" : "PNG or JPG recommended"}</p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">Profile & Preferences</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Personal settings form */}
      <form onSubmit={handleSaveProfile} className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-base font-semibold">Personal Settings</h2>
        <p className="mb-5 text-sm text-muted-foreground">Manage your profile and learning preferences.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="degree">Degree</Label>
            <Input id="degree" value={degree} onChange={(e) => setDegree(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="interests">Current Interests (comma separated)</Label>
            <Input id="interests" value={interests} onChange={(e) => setInterests(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mode">Default Mode</Label>
            <select
              id="mode"
              className={selectClass}
              value={defaultMode}
              onChange={(e) => setDefaultMode(e.target.value as "SEED" | "FOCUS" | "SHADOW")}
            >
              <option value="SEED">SEED</option>
              <option value="FOCUS">FOCUS</option>
              <option value="SHADOW">SHADOW</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hint-level">Default Hint Level</Label>
            <Input
              id="hint-level"
              type="number"
              min={1}
              max={5}
              value={defaultHintLevel}
              onChange={(e) => setDefaultHintLevel(Number(e.target.value))}
              className="h-11"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="code-pref">Code Preference</Label>
            <Input
              id="code-pref"
              value={codePreference}
              onChange={(e) => setCodePreference(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
        <Button type="submit" className="mt-6 h-11" disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </form>

      {/* Quick Friend Request */}
      <form onSubmit={handleAddFriend} className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-base font-semibold">Quick Friend Request</h2>
        <p className="mb-5 text-sm text-muted-foreground">Enter a classmate&apos;s email to send them a friend request.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="friend-email">Friend email</Label>
            <Input
              id="friend-email"
              type="email"
              placeholder="name@example.com"
              value={friendEmail}
              onChange={(event) => setFriendEmail(event.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 sm:w-36">
            Send Request
          </Button>
        </div>
      </form>

      {/* Toast-like status banner */}
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
