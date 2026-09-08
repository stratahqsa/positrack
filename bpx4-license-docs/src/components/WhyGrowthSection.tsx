import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Scale,
  Users,
  TrendingUp,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Shield,
  Eye,
  MessageSquare,
  Zap,
  Store,
  CreditCard,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function WhyGrowthSection() {
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);
  const [showEthicalDetails, setShowEthicalDetails] = useState(false);

  const competitors = [
    {
      name: "Square",
      logo: "■",
      model: "Freemium + Paid Tiers",
      trialApproach: "Free tier forever, 30-day trial on Plus/Premium",
      defaultTier: "Square Free (genuinely usable)",
      howTheyStayHonest: [
        "Free tier is a real product, not a crippled demo",
        "Clear 'Not available in Square Free' labels",
        "Revenue from payment processing, not software lock-in",
        "Easy upgrade/downgrade anytime",
      ],
      plgInsight: "Square monetizes through payment processing (2.6% + 10¢), not software. The free tier hooks users, then they earn on every transaction. Higher tiers offer lower processing fees as incentive to upgrade.",
      relevance: "Similar to Posibolt's potential Groworx Pay strategy - free/cheap software, revenue from payments.",
    },
    {
      name: "Toast",
      logo: "🍞",
      model: "Free Software + Payment Processing",
      trialApproach: "Demo-first, then Starter Kit ($0/mo)",
      defaultTier: "Starter Kit (free but requires Toast payments)",
      howTheyStayHonest: [
        "Transparent that 'free' means payment processing commitment",
        "Hardware often subsidized or free with contract",
        "Clear feature comparison between tiers",
        "No hidden fees - processing rates upfront",
      ],
      plgInsight: "Toast's model is 'free software, paid payments' - they give away the POS to capture payment processing revenue. This is exactly the model Posibolt could adopt with Groworx Pay.",
      relevance: "Direct template for Posibolt's GTM - land with free/cheap software, monetize on payments.",
    },
    {
      name: "Shopify",
      logo: "🛒",
      model: "Short Trial + Extended $1/mo Period",
      trialApproach: "3-day free trial, then $1/mo for 3 months",
      defaultTier: "User selects plan during trial",
      howTheyStayHonest: [
        "Users explicitly choose which plan to trial",
        "Clear feature comparison before selection",
        "Easy downgrade before trial ends",
        "$1B+ paid to partners in 2024 - ecosystem alignment",
      ],
      plgInsight: "Shopify lets users experience premium features during trial but makes them consciously choose. The $1/mo period extends the 'try before you buy' window without being deceptive.",
      relevance: "Shows that defaulting to a higher tier CAN be ethical if done with transparency.",
    },
    {
      name: "Lightspeed",
      logo: "⚡",
      model: "14-Day Trial on All Plans",
      trialApproach: "Full feature access during 14-day trial",
      defaultTier: "User selects plan, all features unlocked",
      howTheyStayHonest: [
        "Geo-targeted pricing (ZAR for SA, USD for International)",
        "No credit card required to start",
        "Clear 'Contact sales' for enterprise",
        "Feature comparison table always visible",
      ],
      plgInsight: "Lightspeed's approach is 'show everything, let them choose'. The 14-day window is short enough to create urgency but long enough to evaluate properly.",
      relevance: "Geo-targeting model is exactly what Posibolt needs for SA/UAE/KSA/International.",
    },
    {
      name: "Zoho",
      logo: "Z",
      model: "Freemium + 15-Day Trial on Paid",
      trialApproach: "Free tier always available, trial on paid tiers",
      defaultTier: "Free tier is the default, paid is opt-in",
      howTheyStayHonest: [
        "Free tier is genuinely useful for small teams",
        "Clear 'upgrade to unlock' messaging",
        "Feature comparison tables everywhere",
        "No aggressive upselling during trial",
      ],
      plgInsight: "Zoho's freemium model means users can stay free forever. Paid tiers are positioned as 'more power' not 'the real product'.",
      relevance: "Shows how to position Lite as a real product, not a demo.",
    },
  ];

  const ethicalSafeguards = [
    {
      title: "Transparent Feature Gating",
      icon: Lock,
      description: "Every locked feature shows a clear indicator with explanation of what tier unlocks it",
      implementation: [
        "Lock icon (🔒) on Pro-only features",
        "Tooltip: 'This feature requires Pro plan. Upgrade to unlock.'",
        "No hidden limitations - everything visible upfront",
        "Feature comparison accessible from any locked feature",
      ],
    },
    {
      title: "Easy Downgrade Path",
      icon: ArrowRight,
      description: "Users can downgrade to Lite anytime before trial ends with one click",
      implementation: [
        "Prominent 'Change Plan' button in settings",
        "Clear comparison of what features will be lost",
        "Data is preserved (just feature access changes)",
        "No penalty or friction for downgrading",
      ],
    },
    {
      title: "Contextual Upgrade Prompts",
      icon: MessageSquare,
      description: "Upgrade prompts only appear when user hits a genuine limit, not randomly",
      implementation: [
        "Show prompt when user tries to use locked feature",
        "Explain the VALUE, not just the price",
        "Allow dismissing prompts (don't block workflow)",
        "Remember dismissals - don't nag repeatedly",
      ],
    },
    {
      title: "Trial Countdown Visibility",
      icon: Eye,
      description: "Users always know how many days remain and what happens after",
      implementation: [
        "Persistent banner: '7 days left in your Growth trial'",
        "Email reminders at Day 7, Day 3, Day 1",
        "Clear explanation of what changes after trial",
        "Option to convert early or downgrade",
      ],
    },
    {
      title: "Data Portability",
      icon: Shield,
      description: "Users can export their data at any tier, no lock-in tactics",
      implementation: [
        "Full data export available on all tiers",
        "Standard formats (CSV, JSON, PDF)",
        "No 'pay to export' schemes",
        "Clear data retention policies",
      ],
    },
  ];

  const whyGrowthReasons = [
    {
      title: "Value Demonstration",
      icon: TrendingUp,
      reason: "Users need to experience the REAL value to make an informed decision",
      detail: "If we default to Lite, users might think 'this is all there is' and leave. Growth shows them what's possible, then they can consciously choose Lite if that's all they need.",
    },
    {
      title: "Faster Time-to-Value",
      icon: Zap,
      reason: "Growth features like multi-location and OMS help users succeed faster",
      detail: "A retailer setting up their first store benefits from seeing how multi-location works, even if they only have one store today. It plants the seed for growth.",
    },
    {
      title: "Industry Standard",
      icon: Scale,
      reason: "Every major SaaS company defaults to showing premium features during trial",
      detail: "Shopify, Lightspeed, Toast, Square - all of them let users experience premium features first. This is the established PLG playbook.",
    },
    {
      title: "Conversion Psychology",
      icon: Users,
      reason: "Users who experience value are more likely to pay for it",
      detail: "The 'endowment effect' means users value what they already have. Experiencing Growth features creates attachment that drives conversion.",
    },
  ];

  const liteUserScenario = {
    title: "What About the Lite Customer?",
    scenario: "A small retailer with 1 location who only needs basic POS",
    journey: [
      {
        step: 1,
        action: "Signs up, defaults to Growth trial",
        experience: "Sees all features, including multi-location (which they don't need)",
      },
      {
        step: 2,
        action: "Uses basic POS features during trial",
        experience: "Everything works great, some features show 🔒 Pro badge",
      },
      {
        step: 3,
        action: "Trial ending notification",
        experience: "Clear message: 'Your trial is ending. Choose your plan.'",
      },
      {
        step: 4,
        action: "Views plan comparison",
        experience: "Sees Lite has everything they need at lower price",
      },
      {
        step: 5,
        action: "Downgrades to Lite",
        experience: "One-click downgrade, data preserved, happy customer",
      },
    ],
    outcome: "The Lite customer got to experience the full product, made an INFORMED decision, and is now a happy paying customer on the right tier for their needs.",
  };

  return (
    <section id="why-growth" className="py-20 bg-gradient-to-b from-amber-50 to-white">
      <div className="container max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-amber-100 text-amber-800 border-amber-300">
            Critical Decision Point
          </Badge>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Why Default to Growth?
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Understanding the PLG strategy behind defaulting new users to the Growth tier,
            with ethical safeguards to ensure transparency and trust.
          </p>
        </div>

        {/* The Core Question */}
        <Card className="mb-12 border-2 border-amber-200 bg-amber-50">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-200 rounded-full">
                <AlertCircle className="w-8 h-8 text-amber-700" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  The Ethical Question
                </h3>
                <p className="text-lg text-slate-700 mb-4">
                  "Are we being unethical if a Lite-only customer experiences the Growth demo and then has to downgrade?"
                </p>
                <div className="bg-white p-4 rounded-lg border border-amber-200">
                  <p className="text-slate-700">
                    <strong>Short answer:</strong> No, if we implement proper transparency safeguards. 
                    Every major retail SaaS company (Square, Toast, Shopify, Lightspeed) does this. 
                    The key is <strong>informed consent</strong> - users must know they're in a trial, 
                    what features are tier-specific, and how to downgrade easily.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why Growth - The Reasons */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            The Strategic Rationale
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {whyGrowthReasons.map((item, index) => (
              <Card key={index} className="border-slate-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <item.icon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                      <p className="text-emerald-700 font-medium mb-2">{item.reason}</p>
                      <p className="text-slate-600 text-sm">{item.detail}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Competitor Analysis */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-4 text-center">
            How Competitors Handle This
          </h3>
          <p className="text-center text-slate-600 mb-8 max-w-2xl mx-auto">
            Every major retail POS/ERP company uses similar PLG strategies. Here's what we can learn from them.
          </p>
          
          <div className="space-y-4">
            {competitors.map((competitor) => (
              <Card 
                key={competitor.name}
                className={`border-slate-200 transition-all cursor-pointer ${
                  expandedCompetitor === competitor.name ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setExpandedCompetitor(
                  expandedCompetitor === competitor.name ? null : competitor.name
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{competitor.logo}</span>
                      <div>
                        <CardTitle className="text-xl">{competitor.name}</CardTitle>
                        <p className="text-slate-600">{competitor.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {competitor.defaultTier}
                      </Badge>
                      {expandedCompetitor === competitor.name ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                {expandedCompetitor === competitor.name && (
                  <CardContent className="pt-4 border-t">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-emerald-600" />
                          How They Stay Honest
                        </h5>
                        <ul className="space-y-2">
                          {competitor.howTheyStayHonest.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-600" />
                          PLG Insight
                        </h5>
                        <p className="text-sm text-slate-600 mb-4">{competitor.plgInsight}</p>
                        
                        <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-600" />
                          Relevance to Posibolt
                        </h5>
                        <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded">{competitor.relevance}</p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Ethical Safeguards */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                Ethical Safeguards (Required Implementation)
              </h3>
              <p className="text-slate-600">
                These UX features keep us honest and build trust with users
              </p>
            </div>
            <button
              onClick={() => setShowEthicalDetails(!showEthicalDetails)}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {showEthicalDetails ? 'Hide Details' : 'Show Details'}
              {showEthicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ethicalSafeguards.map((safeguard, index) => (
              <Card key={index} className="border-emerald-200 bg-emerald-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-200 rounded-lg">
                      <safeguard.icon className="w-5 h-5 text-emerald-700" />
                    </div>
                    <h4 className="font-bold text-slate-900">{safeguard.title}</h4>
                  </div>
                  <p className="text-slate-600 text-sm mb-3">{safeguard.description}</p>
                  
                  {showEthicalDetails && (
                    <div className="bg-white p-3 rounded-lg border border-emerald-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Implementation:</p>
                      <ul className="space-y-1">
                        {safeguard.implementation.map((item, i) => (
                          <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                            <span className="text-emerald-500">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* The Lite Customer Journey */}
        <Card className="mb-16 border-2 border-blue-200">
          <CardHeader className="bg-blue-50 border-b border-blue-200">
            <CardTitle className="flex items-center gap-3">
              <Store className="w-6 h-6 text-blue-600" />
              {liteUserScenario.title}
            </CardTitle>
            <p className="text-slate-600">{liteUserScenario.scenario}</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {liteUserScenario.journey.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1 pb-4 border-b border-slate-100 last:border-0">
                    <p className="font-medium text-slate-900">{step.action}</p>
                    <p className="text-slate-600 text-sm">{step.experience}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">Outcome</p>
                  <p className="text-emerald-700">{liteUserScenario.outcome}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual: Feature Lock Example */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            UX Mockup: How Feature Locking Should Look
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Unlocked Feature */}
            <Card className="border-slate-200">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Unlock className="w-5 h-5 text-emerald-600" />
                  Growth Feature (Unlocked)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Multi-Location Management</h4>
                    <Badge className="bg-emerald-100 text-emerald-700">Growth</Badge>
                  </div>
                  <p className="text-slate-600 text-sm mb-4">
                    Manage inventory, staff, and sales across multiple store locations from a single dashboard.
                  </p>
                  <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Open Location Manager
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Locked Feature */}
            <Card className="border-slate-200">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-600" />
                  Pro Feature (Locked)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-slate-50 border rounded-lg p-4 relative">
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                      🔒 Pro Only
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-500">AI Copilot</h4>
                  </div>
                  <p className="text-slate-500 text-sm mb-4">
                    Get AI-powered insights, anomaly detection, and automated recommendations.
                  </p>
                  <button className="w-full py-2 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    Upgrade to Pro to Unlock
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    Starting at $199/mo • <a href="#" className="text-blue-600 underline">Compare plans</a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Summary Box */}
        <Card className="border-2 border-slate-900 bg-slate-900 text-white">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold mb-4">Summary: The Growth Default is Ethical IF...</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-emerald-400 mb-2">✓ We Must Do</h4>
                <ul className="space-y-2 text-slate-300">
                  <li>• Clear trial countdown always visible</li>
                  <li>• Lock icons on tier-specific features</li>
                  <li>• One-click downgrade path</li>
                  <li>• Email reminders before trial ends</li>
                  <li>• Transparent plan comparison</li>
                  <li>• Data export on all tiers</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-400 mb-2">✗ We Must NOT Do</h4>
                <ul className="space-y-2 text-slate-300">
                  <li>• Hide the trial status</li>
                  <li>• Make downgrading difficult</li>
                  <li>• Lock data behind paid tiers</li>
                  <li>• Use dark patterns to prevent cancellation</li>
                  <li>• Nag users repeatedly to upgrade</li>
                  <li>• Auto-charge without clear consent</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
