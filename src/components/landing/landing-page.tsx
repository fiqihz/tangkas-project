"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Scale,
  TrendingUp,
  LayoutGrid,
  Radio,
  Shuffle,
  Smartphone,
  Languages,
  UserPlus,
  ListPlus,
  Sparkles,
  ClipboardCheck,
  Trophy,
} from "lucide-react";
import { useSettingsStore, useT } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { FeedbackForm } from "./feedback-form";
import { CourtDiagram } from "./court-diagram";
import { FlowSteps, type FlowStep } from "./flow-steps";
import { FaqAccordion, type FaqItem } from "./faq-accordion";
import type { DictKey } from "@/lib/i18n/dict";

const APP_HREF = "/app";

export function LandingPage() {
  const t = useT();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const lang = useSettingsStore((s) => s.lang);
  const setLang = useSettingsStore((s) => s.setLang);

  // Sinkronkan tema & bahasa dari localStorage (dipakai bersama dengan /app).
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const toggleLang = () => setLang(lang === "id" ? "en" : "id");

  // Cara Kerja — 5 langkah (urutan sebenarnya → timeline ber-nomor).
  const steps: FlowStep[] = [
    { icon: UserPlus, titleKey: "landing.how.step0.title", bodyKey: "landing.how.step0.body" },
    { icon: ListPlus, titleKey: "landing.how.step1.title", bodyKey: "landing.how.step1.body" },
    { icon: Sparkles, titleKey: "landing.how.step2.title", bodyKey: "landing.how.step2.body" },
    { icon: ClipboardCheck, titleKey: "landing.how.step3.title", bodyKey: "landing.how.step3.body" },
    { icon: Trophy, titleKey: "landing.how.step4.title", bodyKey: "landing.how.step4.body" },
  ];

  // Fitur sekunder (grid hairline). Matchmaking jadi kartu "featured" terpisah.
  const features: { icon: typeof Scale; titleKey: DictKey; bodyKey: DictKey }[] =
    [
      { icon: TrendingUp, titleKey: "landing.features.level.title", bodyKey: "landing.features.level.body" },
      { icon: LayoutGrid, titleKey: "landing.features.multicourt.title", bodyKey: "landing.features.multicourt.body" },
      { icon: Radio, titleKey: "landing.features.livescore.title", bodyKey: "landing.features.livescore.body" },
      { icon: Shuffle, titleKey: "landing.features.modes.title", bodyKey: "landing.features.modes.body" },
      { icon: Smartphone, titleKey: "landing.features.install.title", bodyKey: "landing.features.install.body" },
    ];

  const faqItems: FaqItem[] = [
    { q: "landing.faq.q1", a: "landing.faq.a1" },
    { q: "landing.faq.q2", a: "landing.faq.a2" },
    { q: "landing.faq.q3", a: "landing.faq.a3" },
    { q: "landing.faq.q4", a: "landing.faq.a4" },
    { q: "landing.faq.q5", a: "landing.faq.a5" },
  ];

  return (
    <div className="min-h-dvh bg-background font-sans text-foreground">
      {/* ═══════════════ NAVBAR ═══════════════ */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Image
              src="/shuttlecock.png"
              alt="TangkasBoard"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="font-display text-lg font-bold tracking-tight">
              TangkasBoard
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              {t("landing.nav.how")}
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              {t("landing.nav.features")}
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              {t("landing.nav.faq")}
            </a>
            <a href="#feedback" className="transition-colors hover:text-foreground">
              {t("landing.nav.feedback")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
              aria-label="Switch language"
            >
              <Languages size={14} />
              {t("landing.langToggle")}
            </button>
            <Link href={APP_HREF}>
              <Button size="sm">{t("landing.nav.openApp")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ═══════════════ HERO ═══════════════ */}
        <section className="relative overflow-hidden">
          {/* Glow teal+hijau lembut di belakang court */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/10 via-accent/10 to-transparent blur-3xl"
          />
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            {/* Kolom teks */}
            <div className="text-center md:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {t("landing.hero.badge")}
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                {t("landing.hero.title")}
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground md:mx-0 md:text-lg">
                {t("landing.hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row md:justify-start">
                <Link href={APP_HREF}>
                  <Button size="lg" className="w-full sm:w-auto">
                    {t("landing.hero.ctaPrimary")}
                  </Button>
                </Link>
                <a href="#how">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {t("landing.hero.ctaSecondary")}
                  </Button>
                </a>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                {t("landing.hero.note")}
              </p>
            </div>

            {/* Kolom visual: court diagram (orchestrated moment) */}
            <div className="relative mx-auto w-full max-w-md">
              <CourtDiagram className="h-auto w-full" />
            </div>
          </div>
        </section>

        {/* ═══════════════ WHAT ═══════════════ */}
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t("landing.what.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
              {t("landing.what.body")}
            </p>
          </div>
        </section>

        {/* ═══════════════ HOW IT WORKS (timeline) ═══════════════ */}
        <section id="how" className="scroll-mt-16">
          <div className="mx-auto max-w-5xl px-4 py-20">
            <div className="mb-14 text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t("landing.how.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground">
                {t("landing.how.subtitle")}
              </p>
            </div>
            <FlowSteps steps={steps} />
          </div>
        </section>

        {/* ═══════════════ FEATURES ═══════════════ */}
        <section id="features" className="scroll-mt-16 border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-5xl px-4 py-20">
            <div className="mb-12 text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t("landing.features.title")}
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Kartu FEATURED: matchmaking — nilai jual utama, span 2 kolom,
                  aksen teal + panel court mini. Di sinilah "boldness" fitur. */}
              <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-7 lg:col-span-2 lg:row-span-2">
                <div className="relative z-10 max-w-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                    <Scale size={24} />
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
                    {t("landing.features.matchmaking.title")}
                  </h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    {t("landing.features.matchmaking.body")}
                  </p>
                  {/* Chip stat kecil — angka sebagai bukti, bukan dekorasi */}
                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-foreground">
                      {t("landing.features.chipLevel")}
                    </span>
                    <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-foreground">
                      {t("landing.features.chipTurns")}
                    </span>
                    <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-foreground">
                      {t("landing.features.chipRepeat")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kartu sekunder — hairline, hierarki lebih tenang */}
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.titleKey}
                    className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent/40 hover:bg-accent/5"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:scale-105">
                      <Icon size={21} />
                    </div>
                    <h3 className="mt-4 font-display font-semibold text-foreground">
                      {t(f.titleKey)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(f.bodyKey)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════ FAQ ═══════════════ */}
        <section id="faq" className="scroll-mt-16">
          <div className="mx-auto max-w-3xl px-4 py-20">
            <div className="mb-10 text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t("landing.faq.title")}
              </h2>
              <p className="mx-auto mt-3 leading-relaxed text-muted-foreground">
                {t("landing.faq.subtitle")}
              </p>
            </div>
            <FaqAccordion items={faqItems} />
          </div>
        </section>

        {/* ═══════════════ FEEDBACK ═══════════════ */}
        <section id="feedback" className="scroll-mt-16">
          <div className="mx-auto max-w-xl px-4 py-20">
            <div className="mb-8 text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t("landing.feedback.title")}
              </h2>
              <p className="mx-auto mt-3 leading-relaxed text-muted-foreground">
                {t("landing.feedback.subtitle")}
              </p>
            </div>
            <FeedbackForm />
          </div>
        </section>
      </main>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-10 text-center">
          <div className="flex items-center gap-2">
            <Image
              src="/shuttlecock.png"
              alt="TangkasBoard"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            <span className="font-display font-bold">TangkasBoard</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("landing.footer.tagline")}
          </p>
          <Link href={APP_HREF}>
            <Button variant="outline" size="sm">
              {t("landing.footer.openApp")}
            </Button>
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            © {new Date().getFullYear()} TangkasBoard · {t("landing.footer.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
