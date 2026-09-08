import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ChevronRight, 
  Globe, 
  Building2, 
  CreditCard, 
  Users, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Zap,
  ArrowRight,
  FileText,
  DollarSign,
  MapPin,
  Calendar,
  RefreshCw,
  Shield,
  Sparkles,
  BookOpen,
  Target,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import CustomerJourneyFlow from "@/components/CustomerJourneyFlow";
import WhyGrowthSection from "@/components/WhyGrowthSection";
import PricingSection from "@/components/PricingSection";
import EntityBillingSection from "@/components/EntityBillingSection";
import BillingPortalSection from "@/components/BillingPortalSection";
import TrialExpirySection from "@/components/TrialExpirySection";
import PaymentFailureSection from "@/components/PaymentFailureSection";
import SystemArchitecture from "@/components/SystemArchitecture";
import FeatureMatrix from "@/components/FeatureMatrix";
import AddOnsSection from "@/components/AddOnsSection";
import PartnerProgramSection from "@/components/PartnerProgramSection";
import GlossarySection from "@/components/GlossarySection";
import ReadinessAssessment from "@/components/ReadinessAssessment";

export default function Home() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section id="overview">
          <HeroSection />
        </section>

        {/* Customer Journey Flow */}
        <section id="customer-journey" className="py-20 bg-white">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">Customer Journey</Badge>
                <h2 className="text-4xl font-bold mb-4">The Complete User Flow</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  From first visit to active subscription - every step of the PLG journey mapped out
                </p>
              </div>
              <CustomerJourneyFlow />
            </motion.div>
          </div>
        </section>

        {/* Why Growth Section - NEW */}
        <section id="why-growth">
          <WhyGrowthSection />
        </section>

        {/* Geo-Targeting & Pricing */}
        <section id="pricing" className="py-20 bg-secondary/30">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">Geo-Targeting & Pricing</Badge>
                <h2 className="text-4xl font-bold mb-4">Regional Pricing Strategy</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Like Lightspeed, pricing adapts to the user's location automatically
                </p>
              </div>
              <PricingSection />
            </motion.div>
          </div>
        </section>

        {/* Entity & Billing Logic */}
        <section id="entity-billing" className="py-20 bg-white">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">Multi-Entity Billing</Badge>
                <h2 className="text-4xl font-bold mb-4">Entity & Invoice Logic</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  How billing entities map to customer locations and generate compliant invoices
                </p>
              </div>
              <EntityBillingSection />
            </motion.div>
          </div>
        </section>

        {/* Billing Portal Prototype - NEW */}
        <section id="billing-portal">
          <BillingPortalSection />
        </section>

        {/* System Architecture */}
        <section id="architecture" className="py-20 bg-white">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">System Architecture</Badge>
                <h2 className="text-4xl font-bold mb-4">How It All Connects</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Kill Bill, Posibolt X Accounting, and Payment Gateways working together
                </p>
              </div>
              <SystemArchitecture />
            </motion.div>
          </div>
        </section>

        {/* Trial Expiry Path */}
        <section id="trial-expiry" className="py-20 bg-secondary/30">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">Trial Management</Badge>
                <h2 className="text-4xl font-bold mb-4">Trial Expiry Path</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Graceful degradation when trials expire without conversion
                </p>
              </div>
              <TrialExpirySection />
            </motion.div>
          </div>
        </section>

        {/* Payment Failure Path */}
        <section id="payment-failure" className="py-20 bg-white">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">Dunning & Recovery</Badge>
                <h2 className="text-4xl font-bold mb-4">Payment Failure Handling</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  The suspension path for failed payments with recovery options
                </p>
              </div>
              <PaymentFailureSection />
            </motion.div>
          </div>
        </section>

        {/* Feature Matrix */}
        <section id="features" className="py-20 bg-secondary/30">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">Plan Comparison</Badge>
                <h2 className="text-4xl font-bold mb-4">Feature Matrix by Tier</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  What's included in Lite, Growth, Pro, and Enterprise
                </p>
              </div>
              <FeatureMatrix />
            </motion.div>
          </div>
        </section>

        {/* Add-Ons Section - NEW (Phase 2) */}
        <section id="add-ons">
          <AddOnsSection />
        </section>

        {/* Partner Program - Expanded */}
        <section id="partner-program">
          <PartnerProgramSection />
        </section>

        {/* Glossary */}
        <section id="glossary" className="py-20 bg-white">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4">Reference</Badge>
                <h2 className="text-4xl font-bold mb-4">Glossary & Key Terms</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Definitions for all technical terms used in this documentation
                </p>
              </div>
              <GlossarySection />
            </motion.div>
          </div>
        </section>

        {/* Readiness Assessment - NEW */}
        <section id="readiness">
          <ReadinessAssessment />
        </section>

        {/* Footer */}
        <footer className="py-12 bg-slate-900 text-white">
          <div className="container">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold">Posibolt X</p>
                  <p className="text-sm text-slate-400">Licensing & Billing Documentation</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Internal Documentation • Last Updated: September 2026
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
