import { HeroSection } from "@/components/hero";
import {
  ActivityTicker,
  CompanySection,
  DemoPreview,
  FAQ,
  HowItWorks,
  StickyCTA,
  TrustSection,
} from "@/components/landing";
import { Footer } from "@/components/layout";
import { AppNavbar } from "@/components/navbar";

export default function Home() {
  return (
    <main className="min-h-screen">
      <AppNavbar homeScrollMorph />
      <HeroSection />
      <ActivityTicker />
      <HowItWorks />
      <DemoPreview />
      <TrustSection />
      <CompanySection />
      <FAQ />
      <Footer />
      <StickyCTA />
    </main>
  );
}
