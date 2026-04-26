"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle2 } from "lucide-react";

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
  const [saving, setSaving] = useState(false);

  async function handleAvatarUpload(file: File) {
    const extension = file.name.split(".").pop() ?? "jpg";
    const filePath = `${userId}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) {
      setStatus(uploadError.message);
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
      setStatus(updateError.message);
      return;
    }

    setAvatarUrl(publicUrl);
    setStatus("Profile photo updated.");
    router.refresh();
  }

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");

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
      setStatus(error.message);
      return;
    }

    setStatus("Profile settings saved.");
    router.refresh();
  }

  async function handleAddFriend(event: React.FormEvent) {
    event.preventDefault();
    setStatus("");

    const normalized = friendEmail.trim().toLowerCase();
    if (!normalized) return;

    const { data: friendProfileData, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    const friendProfile = friendProfileData as FriendLookup | null;

    if (profileError || !friendProfile) {
      setStatus("Friend account not found.");
      return;
    }

    if (friendProfile.id === userId) {
      setStatus("You cannot add yourself.");
      return;
    }

    const { error: insertError } = await supabase.from("friendships").insert({
      user_id: userId,
      friend_id: friendProfile.id,
      status: "accepted"
    });

    if (insertError && !insertError.message.includes("duplicate")) {
      setStatus(insertError.message);
      return;
    }

    setFriendEmail("");
    setStatus("Friend added successfully.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Profile Image</h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Profile avatar" className="size-16 rounded-full border border-border object-cover" />
          ) : (
            <div className="grid size-16 place-content-center rounded-full border border-border bg-background">
              <UserCircle2 className="size-8 text-muted-foreground" />
            </div>
          )}
          <Input
            type="file"
            accept="image/*"
            className="h-11"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleAvatarUpload(file);
            }}
          />
        </div>
      </section>

      <form onSubmit={handleSaveProfile} className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Personal Settings</h2>
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
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
        <Button type="submit" className="mt-5 h-11" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      <form onSubmit={handleAddFriend} className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Add Friend</h2>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            type="email"
            placeholder="Friend email"
            value={friendEmail}
            onChange={(event) => setFriendEmail(event.target.value)}
            className="h-11"
          />
          <Button type="submit" className="h-11">
            Add Friend
          </Button>
        </div>
      </form>

      {status ? <p className="text-sm text-primary">{status}</p> : null}
    </div>
  );
}
