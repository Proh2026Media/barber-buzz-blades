import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  Trophy,
  Star,
  Zap,
  MessageSquare,
  CheckCircle,
  Crown,
  Shield,
  CreditCard,
  Scissors,
  Armchair,
  BadgeCheck,
  Sparkle,
  Diamond,
} from "lucide-react";
import { useTheme } from "@/lib/use-theme";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalCourtesyNotice } from "@/features/legal/LegalPageShell";
import { legalRichText } from "@/features/legal/rich-text";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/politica")({
  component: PoliticaSistemas,
});

function PoliticaSistemas() {
  const { isDark: isDarkMode } = useTheme();
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-10">
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <linearGradient id="hologram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#050505" className="dark:stop-[#F0F9FF]" />
            <stop offset="10%" stopColor="#0d0d0d" className="dark:stop-[#7DD3FC]" />
            <stop offset="30%" stopColor="#B3E5FC" className="dark:stop-[#FFFFFF]" />
            <stop offset="45%" stopColor="#4FC3F7" className="dark:stop-[#F9A8D4]" />
            <stop offset="60%" stopColor="#F8BBD0" className="dark:stop-[#FEF08A]" />
            <stop offset="75%" stopColor="#FFF9C4" className="dark:stop-[#7DD3FC]" />
            <stop offset="90%" stopColor="#4FC3F7" className="dark:stop-[#F0F9FF]" />
            <stop offset="100%" stopColor="#050505" className="dark:stop-[#F0F9FF]" />
          </linearGradient>
        </defs>
      </svg>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/50 p-4 flex items-center justify-between">
        <Link
          to="/"
          className="p-2.5 rounded-2xl bg-muted/30 text-muted-foreground hover:text-foreground transition-all border border-border/50"
          aria-label={t("legal.back")}
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-sm font-black uppercase tracking-widest text-foreground">
          {t("legal.club.header")}
        </h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="p-6 max-w-xl mx-auto space-y-10">
        <LegalCourtesyNotice />
        {/* Intro */}
        <section className="text-center space-y-2">
          <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary border border-primary/20 mb-4 shadow-xl">
            <Crown size={32} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {t("legal.club.heroTitle")}
          </h2>
          <p className="text-muted-foreground text-sm font-medium leading-relaxed italic">
            {t("legal.club.heroBody")}
          </p>
        </section>

        {/* Hierarquia de Status */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 bg-primary rounded-full"></div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              {t("legal.club.s1Title")}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Classic */}
            <div className="bg-card/50 p-5 rounded-[32px] border border-border/60 shadow-sm backdrop-blur-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-silver-metallic rounded-2xl text-black border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                  <Armchair size={20} />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm text-gradient-silver">
                    {t("legal.club.level", { name: "Classic" })}
                  </h3>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    {t("legal.club.pointsRange", { min: 0, max: 99 })}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {t("legal.club.classicBody")}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-foreground/80">
                  <CheckCircle size={10} className="text-gradient-silver" />{" "}
                  {t("legal.club.classicPerk1")}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-foreground/80">
                  <CheckCircle size={10} className="text-gradient-silver" />{" "}
                  {t("legal.club.classicPerk2")}
                </div>
              </div>
            </div>

            {/* Select */}
            <div className="bg-card/50 p-5 rounded-[32px] border border-border/60 shadow-sm backdrop-blur-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-bronze-metallic rounded-2xl text-white border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                  <BadgeCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm text-gradient-bronze">
                    {t("legal.club.level", { name: "Select" })}
                  </h3>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    {t("legal.club.pointsRange", { min: 100, max: 299 })}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {t("legal.club.selectBody")}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-foreground/80">
                  <CheckCircle size={10} className="text-gradient-bronze" />{" "}
                  {t("legal.club.selectPerk1")}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-foreground/80">
                  <CheckCircle size={10} className="text-gradient-bronze" />{" "}
                  {t("legal.club.selectPerk2")}
                </div>
              </div>
            </div>

            {/* Privilege */}
            <div className="bg-card/50 p-5 rounded-[32px] border border-border/60 shadow-sm backdrop-blur-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-gold-metallic rounded-2xl text-black border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                  <Sparkle size={20} />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm text-gradient-gold">
                    {t("legal.club.level", { name: "Privilege" })}
                  </h3>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    {t("legal.club.pointsRange", { min: 300, max: 499 })}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {t("legal.club.privilegeBody")}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-foreground/80">
                  <CheckCircle size={10} className="text-gradient-gold" />{" "}
                  {t("legal.club.privilegePerk1")}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-foreground/80">
                  <CheckCircle size={10} className="text-gradient-gold" />{" "}
                  {t("legal.club.privilegePerk2")}
                </div>
              </div>
            </div>

            {/* Exclusive */}
            <div className="bg-muted/40 p-6 rounded-[32px] border border-border/70 shadow-sm backdrop-blur-lg relative overflow-hidden ring-1 ring-border/50 group">
              <div className="absolute -right-4 -top-4 opacity-10 transition-transform group-hover:scale-110">
                <Diamond size={80} fill="currentColor" className="text-foreground" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`p-2.5 rounded-2xl border transition-transform group-hover:scale-110 shadow-inner ${isDarkMode ? "bg-hologram-metallic border-transparent" : "bg-[#050505] border-border/40"}`}
                >
                  <Diamond
                    size={20}
                    className={`${isDarkMode ? "text-[#050505]" : "text-white"}`}
                    style={{
                      fill: isDarkMode ? "#050505" : "url(#hologram-gradient)",
                      stroke: "none",
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm text-gradient-hologram">
                    {t("legal.club.level", { name: "Exclusive" })}
                  </h3>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    {t("legal.club.exclusiveRange")}
                  </p>
                </div>
              </div>
              <p className="text-xs text-foreground/90 font-medium leading-relaxed mb-5">
                {t("legal.club.exclusiveBody")}
              </p>
              <ul className="space-y-3">
                <li className="text-[10px] font-black flex items-center gap-3">
                  <div
                    className={`p-1 rounded-lg shadow-sm border ${isDarkMode ? "bg-hologram-metallic border-transparent" : "bg-[#050505] border-border/30"}`}
                  >
                    <CheckCircle
                      size={12}
                      className={`${isDarkMode ? "text-[#050505]" : "text-white"}`}
                      style={{
                        fill: isDarkMode ? "#050505" : "url(#hologram-gradient)",
                        stroke: "none",
                      }}
                    />
                  </div>
                  <span className="text-gradient-hologram">{t("legal.club.exclusivePerk1")}</span>
                </li>
                <li className="text-[10px] font-black flex items-center gap-3">
                  <div
                    className={`p-1 rounded-lg shadow-sm border ${isDarkMode ? "bg-hologram-metallic border-transparent" : "bg-[#050505] border-border/30"}`}
                  >
                    <CheckCircle
                      size={12}
                      className={`${isDarkMode ? "text-[#050505]" : "text-white"}`}
                      style={{
                        fill: isDarkMode ? "#050505" : "url(#hologram-gradient)",
                        stroke: "none",
                      }}
                    />
                  </div>
                  <span className="text-gradient-hologram">{t("legal.club.exclusivePerk2")}</span>
                </li>
                <li className="text-[10px] font-black flex items-center gap-3">
                  <div
                    className={`p-1 rounded-lg shadow-sm border ${isDarkMode ? "bg-hologram-metallic border-transparent" : "bg-[#050505] border-border/30"}`}
                  >
                    <CheckCircle
                      size={12}
                      className={`${isDarkMode ? "text-[#050505]" : "text-white"}`}
                      style={{
                        fill: isDarkMode ? "#050505" : "url(#hologram-gradient)",
                        stroke: "none",
                      }}
                    />
                  </div>
                  <span className="text-gradient-hologram">{t("legal.club.exclusivePerk3")}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Diferença Assinatura vs Pontos */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 bg-primary rounded-full"></div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              {t("legal.club.s2Title")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-card/30 border border-border/50 p-6 rounded-[24px] backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-primary" />
                <h5 className="text-[10px] font-black uppercase tracking-widest">
                  {t("legal.club.lifetimeTitle")}
                </h5>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("legal.club.lifetimeBody")}
                <span className="block mt-2 font-black text-foreground bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 inline-block">
                  {t("legal.club.pointRate")}
                </span>
              </p>
            </div>
            <div className="bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/30 p-6 rounded-[24px] backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <Crown size={32} fill="currentColor" className="text-[#D4AF37]" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} fill="currentColor" className="text-[#D4AF37]" />
                <h5 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                  {t("legal.club.subscriptionTitle")}
                </h5>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {legalRichText(t("legal.club.subscriptionBody"), {
                  plan: (
                    <span className="font-black text-[#D4AF37]">{t("legal.club.planName")}</span>
                  ),
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="pt-10 border-t border-border/50 text-center">
          <div className="flex justify-center gap-4 mb-4 grayscale opacity-30">
            <Armchair size={16} />
            <BadgeCheck size={16} />
            <Sparkle size={16} />
            <Diamond size={16} />
          </div>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.4em]">
            Classic · Select · Privilege · Exclusive
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-3 font-medium">
            Arena Barber Club & Lounge © 2026
          </p>
        </section>
      </main>
    </div>
  );
}

export default PoliticaSistemas;
