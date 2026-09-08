import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, 
  UserPlus, 
  Sparkles, 
  CreditCard, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ChevronRight,
  Play,
  Pause
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const journeySteps = [
  {
    id: "step0",
    title: "Step 0: Pre-Signup",
    subtitle: "First Contact",
    icon: Globe,
    color: "bg-blue-500",
    description: "User lands on posibolt.ai, sees geo-targeted pricing",
    details: [
      "AI chatbot engages visitors",
      "Currency & pricing auto-detected by location",
      "Clear CTA: 'Start Free Trial – No Credit Card Required'",
      "No account created yet"
    ],
    userSees: "Pricing page with local currency (ZAR for SA, AED for UAE, USD for International)"
  },
  {
    id: "step1",
    title: "Step 1: Signup & Trial",
    subtitle: "Moment of Commitment",
    icon: UserPlus,
    color: "bg-purple-500",
    description: "User clicks 'Start Free Trial' and creates account",
    details: [
      "Geo-targeting determines: Currency, Plans, Tax, Billing Entity",
      "AI validates company info (LinkedIn, Clearbit)",
      "Tenant created in system",
      "14-day Growth trial activated",
      "Trial license applied"
    ],
    userSees: "Account creation wizard with Path A ('Ready to sell') or Path B ('Just exploring')"
  },
  {
    id: "step2",
    title: "Step 2: Onboarding",
    subtitle: "Value Discovery",
    icon: Sparkles,
    color: "bg-teal-500",
    description: "User experiences the product during trial",
    details: [
      "Auto demo setup based on retail type",
      "Sample products, demo register, tax profile",
      "Quick setup tours guide user",
      "Core POS always works",
      "Advanced features work during trial with 'Pro' badges"
    ],
    userSees: "Homepage checklist, AI chatbot, quick access links"
  },
  {
    id: "step3",
    title: "Step 3: Conversion",
    subtitle: "Payment Moment",
    icon: CreditCard,
    color: "bg-amber-500",
    description: "User clicks 'Upgrade' to convert to paid plan",
    details: [
      "Clear plan comparison shown",
      "Monthly pricing in local currency",
      "Taxes shown transparently",
      "AI recommends plan based on usage",
      "Default payment: Card via regional gateway"
    ],
    userSees: "Plan comparison, pricing, payment form"
  },
  {
    id: "step4",
    title: "Step 4: Active Subscription",
    subtitle: "Business as Usual",
    icon: CheckCircle2,
    color: "bg-green-500",
    description: "User is now a paying customer",
    details: [
      "Features unlock immediately",
      "Monthly invoices arrive automatically",
      "Billing history visible in Pos X",
      "Upgrades: Immediate",
      "Downgrades: End of billing cycle"
    ],
    userSees: "Full access, invoices, billing management"
  }
];

const alternativePaths = [
  {
    id: "trial-expiry",
    title: "Trial Expiry Path",
    icon: Clock,
    color: "bg-orange-500",
    trigger: "If trial expires without conversion",
    stages: [
      { day: "T-7 to T-1", action: "Reminders, full access continues" },
      { day: "Day 0", action: "License → RESTRICTED_PENDING" },
      { day: "Day 1", action: "New POS logins blocked" },
      { day: "Day 3", action: "Full restriction, admin only" },
      { day: "Day 90", action: "Data deleted if not recovered" }
    ]
  },
  {
    id: "payment-failure",
    title: "Payment Failure Path",
    icon: AlertTriangle,
    color: "bg-red-500",
    trigger: "If payment fails after conversion",
    stages: [
      { day: "T-7 to T-1", action: "Pre-dunning reminders" },
      { day: "Day 1", action: "Non-core add-ons disabled" },
      { day: "Day 7", action: "Auto-downgrade to Lite" },
      { day: "Day 14", action: "Full suspension" },
      { day: "Day 90", action: "Data deleted if not recovered" }
    ]
  }
];

export default function CustomerJourneyFlow() {
  const [activeStep, setActiveStep] = useState<string | null>("step0");
  const [showAlternatives, setShowAlternatives] = useState(false);

  const activeStepData = journeySteps.find(s => s.id === activeStep);

  return (
    <div className="space-y-8">
      {/* Main Flow */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-12 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-teal-500 via-amber-500 to-green-500 rounded-full hidden lg:block" />
        
        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 relative">
          {journeySteps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                onClick={() => setActiveStep(step.id)}
                className={`w-full text-left transition-all duration-300 ${
                  activeStep === step.id ? "scale-105" : "hover:scale-102"
                }`}
              >
                <Card className={`relative overflow-hidden ${
                  activeStep === step.id 
                    ? "ring-2 ring-primary shadow-xl" 
                    : "hover:shadow-lg"
                }`}>
                  <CardContent className="p-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center mb-3 mx-auto lg:mx-0`}>
                      <step.icon className="w-6 h-6 text-white" />
                    </div>
                    
                    {/* Content */}
                    <div className="text-center lg:text-left">
                      <p className="text-xs text-muted-foreground mb-1">{step.subtitle}</p>
                      <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{step.description}</p>
                    </div>

                    {/* Active Indicator */}
                    {activeStep === step.id && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-primary"
                      />
                    )}
                  </CardContent>
                </Card>
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Step Details */}
      <AnimatePresence mode="wait">
        {activeStepData && (
          <motion.div
            key={activeStepData.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Left: Details */}
                <div className="p-6 bg-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl ${activeStepData.color} flex items-center justify-center`}>
                      <activeStepData.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{activeStepData.title}</h3>
                      <p className="text-sm text-muted-foreground">{activeStepData.subtitle}</p>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-4">{activeStepData.description}</p>
                  
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">What happens:</p>
                    <ul className="space-y-2">
                      {activeStepData.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right: User Sees */}
                <div className="p-6 bg-slate-50 border-l border-border">
                  <Badge variant="outline" className="mb-4">What the user sees</Badge>
                  <div className="device-frame">
                    <div className="device-frame-inner p-4 min-h-[200px] flex items-center justify-center">
                      <div className="text-center">
                        <activeStepData.icon className="w-12 h-12 text-primary/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">{activeStepData.userSees}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alternative Paths Toggle */}
      <div className="text-center">
        <Button
          variant="outline"
          onClick={() => setShowAlternatives(!showAlternatives)}
          className="gap-2"
        >
          {showAlternatives ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {showAlternatives ? "Hide" : "Show"} Alternative Paths
        </Button>
      </div>

      {/* Alternative Paths */}
      <AnimatePresence>
        {showAlternatives && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {alternativePaths.map((path) => (
              <Card key={path.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className={`${path.color} p-4 text-white`}>
                    <div className="flex items-center gap-3">
                      <path.icon className="w-6 h-6" />
                      <div>
                        <h4 className="font-bold">{path.title}</h4>
                        <p className="text-sm opacity-90">{path.trigger}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {path.stages.map((stage, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {stage.day}
                          </Badge>
                          <span className="text-sm">{stage.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
