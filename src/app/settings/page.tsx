import { redirect } from "next/navigation";
import { Medal, Settings2, Star, UserCircle2 } from "lucide-react";

import { AppHeader } from "@/components/app/app-header";
import { createClient } from "@/lib/supabase/server";

const publicProfiles = [
  { name: "Ayesha", solved: 61, rating: 4.8, mastery: "Advanced" },
  { name: "Hamza", solved: 53, rating: 4.5, mastery: "Intermediate" },
  { name: "Noor", solved: 49, rating: 4.4, mastery: "Intermediate" }
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full border border-border bg-background p-3">
              <UserCircle2 className="size-9 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.email?.split("@")[0] ?? "Learner"}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Problems Solved", value: "48", icon: Medal },
            { label: "IQ Level", value: "118", icon: Star },
            { label: "Coding Mastery", value: "Intermediate+", icon: Settings2 },
            { label: "Stars Rating", value: "4.6 / 5", icon: Star }
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <Icon className="mb-3 size-5 text-primary" />
                <p className="text-xl font-bold">{metric.value}</p>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Personal Settings</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-background/60 p-3">
                Default Mode: <span className="font-medium text-foreground">FOCUS</span>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                Default Hint Level: <span className="font-medium text-foreground">3 / 5</span>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                Code Preference: <span className="font-medium text-foreground">No code unless requested</span>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Other Student Profiles</h2>
            <div className="space-y-3">
              {publicProfiles.map((profile) => (
                <div
                  key={profile.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {profile.solved} solved • {profile.mastery}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-primary">{profile.rating}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
