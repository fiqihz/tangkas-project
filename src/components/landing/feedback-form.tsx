"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitFeedback } from "@/lib/supabase/repo";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useT } from "@/lib/store/settings-store";

type Status = "idle" | "sending" | "success" | "error";

/**
 * Form masukan di landing page. Anonim (kontak opsional). Menyimpan ke tabel
 * `feedback` di Supabase; notifikasi email ke host di-handle server-side
 * (Edge Function + Resend). Semua wording lewat i18n (t()).
 */
export function FeedbackForm() {
  const t = useT();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setStatus("error");
      return;
    }
    if (!isSupabaseConfigured()) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      await submitFeedback(message, contact);
      setStatus("success");
      setMessage("");
      setContact("");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
        <div className="text-4xl">🎉</div>
        <p className="mt-3 font-medium text-foreground">
          {t("landing.feedback.success")}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setStatus("idle")}
        >
          {t("landing.feedback.submit")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="fb-message"
          className="text-sm font-medium text-foreground"
        >
          {t("landing.feedback.messageLabel")}
        </label>
        <textarea
          id="fb-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder={t("landing.feedback.messagePlaceholder")}
          rows={4}
          maxLength={4000}
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="fb-contact"
          className="text-sm font-medium text-foreground"
        >
          {t("landing.feedback.contactLabel")}
        </label>
        <Input
          id="fb-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t("landing.feedback.contactPlaceholder")}
          maxLength={200}
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-destructive">
          {message.trim()
            ? t("landing.feedback.error")
            : t("landing.feedback.emptyError")}
        </p>
      )}

      <Button type="submit" size="lg" disabled={status === "sending"}>
        {status === "sending"
          ? t("landing.feedback.sending")
          : t("landing.feedback.submit")}
      </Button>
    </form>
  );
}
