import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Building2,
  Globe,
  DollarSign,
  Award,
  BookOpen,
  Handshake,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Lightbulb,
  Shield,
  TrendingUp,
  Percent,
  Calendar,
  FileText,
  MessageSquare,
  Zap,
  Star,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

export default function PartnerProgramSection() {
  const [expandedSection, setExpandedSection] = useState<string | null>("tiers");
  const [showCompetitorDetails, setShowCompetitorDetails] = useState(false);

  const partnerTiers = [
    {
      name: "Registered",
      color: "bg-slate-500",
      requirements: [
        "Complete partner application",
        "Accept partner agreement",
        "Complete basic product training",
      ],
      benefits: [
        "Partner portal access",
        "Basic sales materials",
        "Lead registration",
        "10% referral commission",
      ],
      revenueShare: "10%",
      support: "Email only",
      targetPartner: "New partners exploring the relationship",
    },
    {
      name: "Silver",
      color: "bg-slate-400",
      requirements: [
        "3+ closed deals in 6 months",
        "1 certified consultant",
        "Complete advanced training",
        "R50K+ quarterly revenue",
      ],
      benefits: [
        "All Registered benefits",
        "Co-branded materials",
        "Deal registration protection",
        "15% referral commission",
        "Quarterly business reviews",
      ],
      revenueShare: "15%",
      support: "Email + Chat",
      targetPartner: "Active partners with proven sales",
    },
    {
      name: "Gold",
      color: "bg-amber-500",
      requirements: [
        "10+ closed deals in 6 months",
        "3 certified consultants",
        "R150K+ quarterly revenue",
        "Customer satisfaction score 4.5+",
      ],
      benefits: [
        "All Silver benefits",
        "Priority lead distribution",
        "Joint marketing funds (MDF)",
        "20% referral commission",
        "Dedicated partner manager",
        "Beta access to new features",
      ],
      revenueShare: "20%",
      support: "Dedicated PM + Priority",
      targetPartner: "Strategic partners driving significant revenue",
    },
    {
      name: "Platinum",
      color: "bg-purple-500",
      requirements: [
        "25+ closed deals in 6 months",
        "5+ certified consultants",
        "R500K+ quarterly revenue",
        "Regional exclusivity consideration",
      ],
      benefits: [
        "All Gold benefits",
        "25% referral commission",
        "Executive sponsor",
        "Product roadmap input",
        "Custom integrations support",
        "Annual partner summit invitation",
        "Regional marketing campaigns",
      ],
      revenueShare: "25%",
      support: "Executive Sponsor + 24/7",
      targetPartner: "Elite partners with regional dominance",
    },
  ];

  const commissionModels = [
    {
      model: "Referral Commission",
      description: "One-time payment for referred customers who convert",
      calculation: "% of first year's subscription value",
      example: "Customer signs Growth annual (R15,588) → 15% = R2,338 commission",
      pros: ["Simple to understand", "Immediate payout", "Low ongoing admin"],
      cons: ["No recurring revenue for partner", "Less incentive for retention"],
      bestFor: "Partners who refer but don't implement",
    },
    {
      model: "Revenue Share",
      description: "Ongoing percentage of customer's subscription",
      calculation: "% of monthly/annual subscription, paid monthly",
      example: "Customer pays R1,299/mo → 15% = R195/mo ongoing",
      pros: ["Recurring revenue for partner", "Aligned incentives for retention", "Higher lifetime value"],
      cons: ["More complex tracking", "Longer payback period"],
      bestFor: "Implementation partners with ongoing relationships",
    },
    {
      model: "Hybrid Model",
      description: "Upfront bonus + smaller ongoing share",
      calculation: "One-time bonus + reduced % ongoing",
      example: "R1,000 upfront + 5% ongoing (R65/mo)",
      pros: ["Immediate reward + long-term alignment", "Balanced risk"],
      cons: ["Most complex to administer"],
      bestFor: "Strategic partners wanting both immediate and recurring",
    },
  ];

  const partnerTypes = [
    {
      type: "Referral Partners",
      icon: Users,
      description: "Refer leads but don't implement",
      examples: ["Accountants", "Business consultants", "Industry associations"],
      typicalTier: "Registered → Silver",
      commission: "10-15% referral",
    },
    {
      type: "Implementation Partners",
      icon: Building2,
      description: "Implement and support customers",
      examples: ["IT consultancies", "ERP implementers", "System integrators"],
      typicalTier: "Silver → Gold",
      commission: "15-20% revenue share",
    },
    {
      type: "Resellers",
      icon: DollarSign,
      description: "Buy wholesale, sell to end customers",
      examples: ["Regional distributors", "Value-added resellers"],
      typicalTier: "Gold → Platinum",
      commission: "20-30% margin",
    },
    {
      type: "Technology Partners",
      icon: Zap,
      description: "Build integrations and apps",
      examples: ["Payment providers", "eCommerce platforms", "Hardware vendors"],
      typicalTier: "Gold",
      commission: "Revenue share on joint sales",
    },
  ];

  const competitorPrograms = [
    {
      company: "Shopify",
      programName: "Shopify Partner Program",
      highlights: [
        "$1B+ paid to partners in 2024",
        "Multiple revenue streams (apps, themes, referrals, services)",
        "Built for Shopify certification",
        "Partner Academy with free courses",
      ],
      commissionStructure: "20% recurring revenue share for referrals",
      lessonsForPosibolt: "Invest heavily in partner education and certification. Multiple ways to earn = more engaged partners.",
    },
    {
      company: "Odoo",
      programName: "Odoo Partner Program",
      highlights: [
        "Tiered system (Ready, Silver, Gold)",
        "Geographic territory management",
        "Strong certification requirements",
        "Partner-only features and pricing",
      ],
      commissionStructure: "15-50% margin based on tier and deal size",
      lessonsForPosibolt: "Territory management prevents partner conflicts. Certification creates quality bar.",
    },
    {
      company: "Zoho",
      programName: "Zoho Partner Program",
      highlights: [
        "Authorized, Advanced, Premium tiers",
        "Zoho Partner Portal with deal registration",
        "Marketing development funds (MDF)",
        "Partner-exclusive pricing",
      ],
      commissionStructure: "20-35% based on tier",
      lessonsForPosibolt: "Deal registration protects partner investments. MDF helps partners market locally.",
    },
  ];

  const criticalConsiderations = [
    {
      category: "Legal & Contracts",
      icon: FileText,
      items: [
        {
          item: "Partner Agreement Template",
          status: "Required",
          notes: "Standard terms for all partners, reviewed by legal",
        },
        {
          item: "Territory Clauses",
          status: "Decide",
          notes: "Exclusive vs non-exclusive territories? Regional restrictions?",
        },
        {
          item: "Non-Compete Terms",
          status: "Decide",
          notes: "Can partners sell competing products? What's the definition?",
        },
        {
          item: "Data Protection (GDPR/POPIA)",
          status: "Required",
          notes: "How do partners handle customer data? DPA required?",
        },
        {
          item: "Termination Clauses",
          status: "Required",
          notes: "Notice period, commission on existing customers, data handover",
        },
        {
          item: "IP & Branding Rights",
          status: "Required",
          notes: "Logo usage, co-branding guidelines, approval process",
        },
      ],
    },
    {
      category: "Operations & Process",
      icon: Target,
      items: [
        {
          item: "Deal Registration System",
          status: "Required",
          notes: "How do partners register leads? Protection period? Conflict resolution?",
        },
        {
          item: "Lead Distribution Rules",
          status: "Decide",
          notes: "How are inbound leads assigned to partners? Round-robin? Territory?",
        },
        {
          item: "Commission Tracking",
          status: "Required",
          notes: "System to track referrals, calculate commissions, handle disputes",
        },
        {
          item: "Partner Portal",
          status: "Required",
          notes: "Self-service access to deals, commissions, materials, training",
        },
        {
          item: "Onboarding Process",
          status: "Required",
          notes: "How long? What's included? Who owns it?",
        },
        {
          item: "Performance Reviews",
          status: "Decide",
          notes: "Quarterly? Annual? What metrics? Tier up/down process?",
        },
      ],
    },
    {
      category: "Conflict Resolution",
      icon: AlertTriangle,
      items: [
        {
          item: "Direct vs Partner Attribution",
          status: "Critical",
          notes: "If customer comes direct but partner claims them, who wins?",
        },
        {
          item: "Partner vs Partner Conflicts",
          status: "Critical",
          notes: "Two partners claim same lead - resolution process?",
        },
        {
          item: "Commission Disputes",
          status: "Required",
          notes: "Escalation path, evidence requirements, final arbiter",
        },
        {
          item: "Customer Complaints About Partner",
          status: "Required",
          notes: "How do we handle? Impact on partner status?",
        },
      ],
    },
    {
      category: "Financial & Payments",
      icon: DollarSign,
      items: [
        {
          item: "Payment Terms",
          status: "Decide",
          notes: "Net 30? Net 60? Monthly? After customer pays?",
        },
        {
          item: "Currency Handling",
          status: "Required",
          notes: "Pay in partner's currency or customer's? FX risk?",
        },
        {
          item: "Minimum Payout Threshold",
          status: "Decide",
          notes: "Accumulate until $100? $500? No minimum?",
        },
        {
          item: "Clawback Policy",
          status: "Required",
          notes: "If customer churns in 3 months, do we claw back commission?",
        },
        {
          item: "Tax Documentation",
          status: "Required",
          notes: "W-9, VAT registration, withholding requirements by country",
        },
      ],
    },
    {
      category: "Enablement & Support",
      icon: BookOpen,
      items: [
        {
          item: "Training Curriculum",
          status: "Required",
          notes: "Sales training, product training, implementation training",
        },
        {
          item: "Certification Program",
          status: "Recommended",
          notes: "Exams, badges, renewal requirements",
        },
        {
          item: "Sales Materials",
          status: "Required",
          notes: "Pitch decks, one-pagers, case studies, demo environments",
        },
        {
          item: "Technical Documentation",
          status: "Required",
          notes: "Implementation guides, API docs, troubleshooting",
        },
        {
          item: "Partner Support Channel",
          status: "Required",
          notes: "Dedicated Slack/Teams? Email? Phone? SLA?",
        },
      ],
    },
  ];

  const commonMistakes = [
    {
      mistake: "Launching without clear goals",
      consequence: "Can't measure success, partners don't know what's expected",
      prevention: "Set SMART goals: '50 partners, R2M partner-sourced revenue in Year 1'",
    },
    {
      mistake: "Recruiting all partners equally",
      consequence: "Resources spread thin, top partners underserved",
      prevention: "Define ideal partner profile, focus on quality over quantity",
    },
    {
      mistake: "Over-complicated commission structure",
      consequence: "Partners can't calculate earnings, disputes increase",
      prevention: "Simple model: '20% of first year' or '15% ongoing'",
    },
    {
      mistake: "Ignoring partner onboarding",
      consequence: "Partners sign up but never sell",
      prevention: "Structured 30-day onboarding with milestones and check-ins",
    },
    {
      mistake: "No deal registration protection",
      consequence: "Partners invest in leads, then lose to direct sales",
      prevention: "Clear registration rules, 90-day protection, conflict resolution",
    },
    {
      mistake: "Treating all partners the same",
      consequence: "Top partners feel undervalued, leave for competitors",
      prevention: "Tiered program with increasing benefits for performance",
    },
  ];

  return (
    <section id="partner-program" className="py-20 bg-gradient-to-b from-indigo-50 to-white">
      <div className="container max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-indigo-100 text-indigo-800 border-indigo-300">
            Phase 2 Planning
          </Badge>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Partner & Reseller Program
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            A comprehensive framework for building a channel partner program that scales Posibolt X 
            into new regions through trusted local partners.
          </p>
        </div>

        {/* Phase 2 Notice */}
        <Card className="mb-12 border-2 border-indigo-200 bg-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-200 rounded-full">
                <Calendar className="w-6 h-6 text-indigo-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  This is Phase 2 - Document Now, Build Later
                </h3>
                <p className="text-slate-700">
                  The partner program is planned for Phase 2 of the Posibolt X launch. This documentation 
                  captures best practices, considerations, and decisions needed so we're ready to execute 
                  when the time comes. Use this as a planning reference, not an implementation guide.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="structure" className="mb-12">
          <TabsList className="grid grid-cols-5 mb-8">
            <TabsTrigger value="structure">Program Structure</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="competitors">Competitor Analysis</TabsTrigger>
            <TabsTrigger value="considerations">Critical Decisions</TabsTrigger>
            <TabsTrigger value="mistakes">Common Mistakes</TabsTrigger>
          </TabsList>

          {/* Program Structure */}
          <TabsContent value="structure">
            <div className="space-y-8">
              {/* Partner Tiers */}
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Partner Tiers</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {partnerTiers.map((tier, index) => (
                    <Card key={index} className="border-slate-200 hover:shadow-lg transition-shadow">
                      <CardHeader className={`${tier.color} text-white rounded-t-lg`}>
                        <CardTitle className="flex items-center justify-between">
                          <span>{tier.name}</span>
                          <Badge className="bg-white/20 text-white border-white/30">
                            {tier.revenueShare}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Requirements</p>
                          <ul className="space-y-1">
                            {tier.requirements.map((req, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                <CheckCircle className="w-3 h-3 text-emerald-500 mt-1 shrink-0" />
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Benefits</p>
                          <ul className="space-y-1">
                            {tier.benefits.slice(0, 4).map((benefit, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                <Star className="w-3 h-3 text-amber-500 mt-1 shrink-0" />
                                {benefit}
                              </li>
                            ))}
                            {tier.benefits.length > 4 && (
                              <li className="text-sm text-indigo-600">
                                +{tier.benefits.length - 4} more benefits
                              </li>
                            )}
                          </ul>
                        </div>
                        <div className="pt-3 border-t border-slate-100">
                          <p className="text-xs text-slate-500">
                            <strong>Target:</strong> {tier.targetPartner}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Partner Types */}
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Partner Types</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {partnerTypes.map((type, index) => (
                    <Card key={index} className="border-slate-200">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-indigo-100 rounded-lg">
                            <type.icon className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 mb-1">{type.type}</h4>
                            <p className="text-slate-600 text-sm mb-3">{type.description}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {type.examples.map((ex, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {ex}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">Typical Tier: <strong className="text-slate-700">{type.typicalTier}</strong></span>
                              <span className="text-emerald-600 font-medium">{type.commission}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Commissions */}
          <TabsContent value="commissions">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Commission Models</h3>
              
              {commissionModels.map((model, index) => (
                <Card key={index} className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Percent className="w-5 h-5 text-emerald-600" />
                      {model.model}
                    </CardTitle>
                    <p className="text-slate-600">{model.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="bg-slate-50 p-4 rounded-lg mb-4">
                          <p className="text-sm font-semibold text-slate-700 mb-1">Calculation</p>
                          <p className="text-slate-600">{model.calculation}</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-emerald-700 mb-1">Example</p>
                          <p className="text-emerald-600">{model.example}</p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Pros</p>
                          <ul className="space-y-1">
                            {model.pros.map((pro, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                {pro}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Cons</p>
                          <ul className="space-y-1">
                            {model.cons.map((con, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-500" />
                                {con}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-indigo-50 p-3 rounded-lg">
                          <p className="text-sm text-indigo-700">
                            <strong>Best For:</strong> {model.bestFor}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Recommendation */}
              <Card className="border-2 border-emerald-200 bg-emerald-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-200 rounded-full">
                      <Lightbulb className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">Recommendation for Posibolt X</h4>
                      <p className="text-slate-700 mb-4">
                        Start with <strong>Revenue Share (15-20%)</strong> for implementation partners and 
                        <strong> Referral Commission (10-15%)</strong> for referral-only partners. This aligns 
                        incentives for customer retention while keeping the model simple to understand.
                      </p>
                      <div className="bg-white p-4 rounded-lg border border-emerald-200">
                        <p className="text-sm text-slate-600">
                          <strong>Simple Pitch:</strong> "Refer a customer, earn 15% of their first year. 
                          Implement and support them, earn 20% ongoing."
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Competitor Analysis */}
          <TabsContent value="competitors">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">What Competitors Do</h3>
              
              {competitorPrograms.map((competitor, index) => (
                <Card key={index} className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{competitor.company}</span>
                      <Badge variant="outline">{competitor.programName}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Program Highlights</p>
                        <ul className="space-y-2">
                          {competitor.highlights.map((highlight, i) => (
                            <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="bg-slate-50 p-4 rounded-lg mb-4">
                          <p className="text-sm font-semibold text-slate-700 mb-1">Commission Structure</p>
                          <p className="text-slate-600">{competitor.commissionStructure}</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-indigo-700 mb-1">Lessons for Posibolt</p>
                          <p className="text-indigo-600 text-sm">{competitor.lessonsForPosibolt}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Critical Decisions */}
          <TabsContent value="considerations">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Critical Decisions & Considerations</h3>
              <p className="text-slate-600 mb-6">
                These are the decisions and processes that must be defined before launching the partner program.
                Items marked "Required" are non-negotiable; "Decide" items need a policy decision.
              </p>
              
              {criticalConsiderations.map((category, index) => (
                <Card key={index} className="border-slate-200">
                  <CardHeader 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedSection(expandedSection === category.category ? null : category.category)}
                  >
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <category.icon className="w-5 h-5 text-indigo-600" />
                        {category.category}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{category.items.length} items</Badge>
                        {expandedSection === category.category ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  {expandedSection === category.category && (
                    <CardContent>
                      <div className="space-y-3">
                        {category.items.map((item, i) => (
                          <div key={i} className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg">
                            <Badge 
                              className={`shrink-0 ${
                                item.status === "Required" ? "bg-red-100 text-red-700 border-red-300" :
                                item.status === "Critical" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                item.status === "Decide" ? "bg-amber-100 text-amber-700 border-amber-300" :
                                "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {item.status}
                            </Badge>
                            <div>
                              <p className="font-medium text-slate-900">{item.item}</p>
                              <p className="text-sm text-slate-600">{item.notes}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Common Mistakes */}
          <TabsContent value="mistakes">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Common Mistakes to Avoid</h3>
              <p className="text-slate-600 mb-6">
                Learn from others' failures. These are the most common reasons partner programs fail.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                {commonMistakes.map((item, index) => (
                  <Card key={index} className="border-slate-200">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{item.mistake}</h4>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-red-50 p-3 rounded-lg">
                          <p className="text-sm text-red-700">
                            <strong>Consequence:</strong> {item.consequence}
                          </p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-lg">
                          <p className="text-sm text-emerald-700">
                            <strong>Prevention:</strong> {item.prevention}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary Checklist */}
        <Card className="border-2 border-slate-900 bg-slate-900 text-white">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold mb-6">Partner Program Launch Checklist</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-emerald-400 mb-3">Before Launch</h4>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Define partner tiers and requirements
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Create partner agreement (legal review)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Build partner portal
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Set up commission tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Create training materials
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-400 mb-3">At Launch</h4>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Recruit 10-20 pilot partners
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Run structured onboarding
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Assign partner manager
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Set up weekly check-ins
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Gather feedback actively
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-amber-400 mb-3">Ongoing</h4>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Quarterly business reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Track partner-sourced revenue
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Manage tier promotions/demotions
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Update training materials
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded"></div>
                    Annual partner summit
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
