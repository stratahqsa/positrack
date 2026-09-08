import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Code2,
  ListChecks,
  ClipboardCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const toneStyles = {
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "border-emerald-200",
    bar: "bg-emerald-500",
    track: "bg-emerald-100",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "border-amber-200",
    bar: "bg-amber-500",
    track: "bg-amber-100",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "border-red-200",
    bar: "bg-red-500",
    track: "bg-red-100",
  },
  slate: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "border-slate-200",
    bar: "bg-slate-500",
    track: "bg-slate-200",
  },
} as const;

const scoreCards = [
  {
    label: "Business Logic",
    value: "85%",
    percent: 85,
    tone: "emerald",
    icon: CheckCircle2,
    description: "Journeys, tiers, flows well-defined.",
  },
  {
    label: "Technical Spec",
    value: "25%",
    percent: 25,
    tone: "amber",
    icon: Code2,
    description: "Architecture, APIs, schema absent.",
  },
  {
    label: "Open Questions",
    value: "14",
    percent: null,
    tone: "red",
    icon: HelpCircle,
    description: "From gap analysis, unanswered.",
  },
  {
    label: "Time Invested",
    value: "5w 2d",
    percent: null,
    tone: "slate",
    icon: Clock,
    description: "Across 18 months, 15 sprints.",
  },
] as const;

const blockers = [
  {
    title: "Kill Bill Integration",
    body: "No technical specification. Named as the subscription engine. No API specs. No data model mapping. No sync strategy.",
  },
  {
    title: "Multi-Tenancy Architecture",
    body: "Undefined. Single database or separate? No data archival strategy. No GDPR/POPIA handling.",
  },
  {
    title: "No API Specification",
    body: "Not a single endpoint defined. No auth mechanism. No rate limits.",
  },
  {
    title: "No Database Schema",
    body: "Entities described conceptually. Never modeled. No ERD.",
  },
];

const majorGaps = [
  {
    title: "License Token Format",
    body: 'PRD mentions a "48h offline token cache" but no format specified. JWT? Claims? Tamper protection?',
  },
  {
    title: "Feature Gating",
    body: "Matrix lists what each tier gets. Not how limits are enforced. What happens to data after downgrade?",
  },
  {
    title: "Event Architecture",
    body: "No event bus. No schema. No propagation strategy for state changes.",
  },
  {
    title: "Legacy Migration",
    body: "Existing customers have no path to new tiers. No data migration plan.",
  },
];

const openDecisions = [
  "Should manual billing be Enterprise-only or negotiable for Pro?",
  "Should reseller commissions default to cash payout or license credit?",
  "Should Kill Bill invoices show as proforma or be hidden?",
  "Allow mid-month downgrades or restrict to cycle-end?",
  "No pricing numbers. Tiers exist but no ZAR, AED, or SAR amounts.",
  "Partner commission percentages undefined. What percent, for how long, on gross or net?",
];

const nextSteps = [
  {
    title: "Answer the dev team honestly",
    body: "4 blockers remain before code starts.",
  },
  {
    title: "Close the 4 open product decisions",
    body: "A 30-minute call, not more discovery.",
  },
  {
    title: "Produce a Technical Design Document",
    body: "Kill Bill contract, database schema, API spec, license token format. Assign to a senior dev. Timebox to 2 weeks.",
  },
  {
    title: "Set actual pricing before beta launch",
    body: "Start with SA (ZAR), derive UAE/KSA.",
  },
];

function ScoreCard({ item }: { item: (typeof scoreCards)[number] }) {
  const tone = toneStyles[item.tone];
  const Icon = item.icon;
  return (
    <Card className={`border ${tone.ring}`}>
      <CardContent className="p-6">
        <div className={`w-10 h-10 rounded-xl ${tone.bg} flex items-center justify-center mb-4`}>
          <Icon className={`w-5 h-5 ${tone.text}`} />
        </div>
        <p className={`text-3xl font-bold mb-1 ${tone.text}`}>{item.value}</p>
        <p className="font-semibold text-sm mb-2">{item.label}</p>
        {item.percent !== null && (
          <div className={`h-1.5 w-full rounded-full ${tone.track} overflow-hidden mb-2`}>
            <div
              className={`h-full rounded-full ${tone.bar}`}
              style={{ width: `${item.percent}%` }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </CardContent>
    </Card>
  );
}

function CalloutList({
  icon: Icon,
  iconClass,
  title,
  subtitle,
  items,
  borderClass,
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  subtitle: string;
  items: { title: string; body: string }[];
  borderClass: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mb-12"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${iconClass}`} />
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((item) => (
          <Card key={item.title} className={`border-l-4 ${borderClass}`}>
            <CardContent className="p-5">
              <p className="font-semibold mb-1">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

export default function ReadinessAssessment() {
  return (
    <section id="readiness" className="py-20 bg-slate-50">
      <div className="container max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4">
            <ClipboardCheck className="w-3 h-3 mr-1" />
            Readiness Check
          </Badge>
          <h2 className="text-4xl font-bold mb-4">Is This Ready to Build?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A plain read on what is solid and what is missing before development starts.
          </p>
        </motion.div>

        {/* Verdict Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="mb-12 border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-red-50">
            <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-3 bg-amber-200 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-800" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 mb-1 leading-snug">
                  Strong vision. Incomplete specification. Not yet ready for development.
                </p>
                <p className="text-slate-600">
                  The discovery defines what the system should do. It does not define how to
                  build it.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Score Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
        >
          {scoreCards.map((item) => (
            <ScoreCard key={item.label} item={item} />
          ))}
        </motion.div>

        {/* Blockers */}
        <CalloutList
          icon={XCircle}
          iconClass="text-red-600"
          title="Blockers"
          subtitle="Nothing ships until these have answers."
          items={blockers}
          borderClass="border-l-red-500"
        />

        {/* Major Gaps */}
        <CalloutList
          icon={AlertTriangle}
          iconClass="text-amber-600"
          title="Major Gaps"
          subtitle="Known unknowns. Real risk if skipped."
          items={majorGaps}
          borderClass="border-l-amber-500"
        />

        {/* Open Product Decisions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <h3 className="text-xl font-bold">Open Product Decisions</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Not blockers. Just calls nobody has made yet.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {openDecisions.map((decision) => (
              <Card key={decision} className="border-l-4 border-l-blue-500">
                <CardContent className="p-5">
                  <p className="text-sm">{decision}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xl font-bold">Next Steps</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Four moves. Two weeks. Then build.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {nextSteps.map((step, index) => (
              <Card key={step.title} className="border-l-4 border-l-emerald-500">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold mb-1">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
