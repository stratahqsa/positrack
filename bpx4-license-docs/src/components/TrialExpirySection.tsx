import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Clock, 
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Bell,
  Lock,
  Unlock,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const timelineSteps = [
  {
    day: "T-7 to T-1",
    title: "Countdown Period",
    status: "warning",
    icon: Bell,
    color: "bg-amber-500",
    access: "Full Access",
    actions: [
      "Daily reminder emails sent",
      "In-app banner shows days remaining",
      "AI chatbot prompts to upgrade",
      "All features still work"
    ]
  },
  {
    day: "Day 0",
    title: "Trial Expired",
    status: "danger",
    icon: Clock,
    color: "bg-orange-500",
    access: "Grace Period",
    actions: [
      "License status → RESTRICTED_PENDING",
      "Existing sessions continue working",
      "No new logins allowed",
      "Urgent email sent"
    ]
  },
  {
    day: "Day 1",
    title: "Soft Restriction",
    status: "danger",
    icon: Lock,
    color: "bg-red-400",
    access: "Limited Access",
    actions: [
      "New POS logins blocked",
      "Back-office becomes read-only",
      "Billing section still accessible",
      "Data remains intact"
    ]
  },
  {
    day: "Day 3",
    title: "Full Restriction",
    status: "critical",
    icon: XCircle,
    color: "bg-red-600",
    access: "Admin Only",
    actions: [
      "All users blocked except admin",
      "Admin limited to subscription screen",
      "Clear CTA to select plan",
      "90-day data retention starts"
    ]
  },
  {
    day: "Day 90",
    title: "Data Deletion",
    status: "critical",
    icon: AlertTriangle,
    color: "bg-slate-600",
    access: "No Access",
    actions: [
      "All tenant data permanently deleted",
      "Account marked as churned",
      "Cannot be recovered",
      "Final warning at Day 80"
    ]
  }
];

const recoveryPath = {
  title: "Recovery Path",
  description: "At any point before Day 90, the customer can recover by selecting a plan and completing payment.",
  steps: [
    "Admin logs in → sees subscription screen only",
    "Selects plan (Lite/Growth/Pro)",
    "Enters payment details",
    "Payment processed → License reactivated",
    "Full access restored immediately"
  ]
};

export default function TrialExpirySection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="space-y-8">
      {/* Overview */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">14-Day Trial → Graceful Degradation</h3>
              <p className="text-muted-foreground">
                When a trial expires without conversion, we don't immediately lock out the user. 
                Instead, we gradually restrict access while preserving their data for 90 days, 
                giving them multiple opportunities to convert.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute top-6 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-orange-500 via-red-500 to-slate-600 rounded-full hidden lg:block" />
        
        {/* Timeline Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 relative">
          {timelineSteps.map((step, index) => (
            <motion.div
              key={step.day}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                onClick={() => setActiveStep(index)}
                className="w-full"
              >
                <Card className={`relative transition-all ${
                  activeStep === index 
                    ? "ring-2 ring-primary shadow-xl scale-105" 
                    : "hover:shadow-lg"
                }`}>
                  <CardContent className="p-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center mb-3 mx-auto relative z-10`}>
                      <step.icon className="w-6 h-6 text-white" />
                    </div>
                    
                    {/* Content */}
                    <div className="text-center">
                      <Badge variant="outline" className="mb-2">{step.day}</Badge>
                      <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                      <Badge 
                        variant={step.status === "warning" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {step.access}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Step Details */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 rounded-xl ${timelineSteps[activeStep].color} flex items-center justify-center`}>
              {(() => {
                const Icon = timelineSteps[activeStep].icon;
                return <Icon className="w-6 h-6 text-white" />;
              })()}
            </div>
            <div>
              <Badge variant="outline" className="mb-1">{timelineSteps[activeStep].day}</Badge>
              <h3 className="font-bold text-xl">{timelineSteps[activeStep].title}</h3>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">What Happens</h4>
              <ul className="space-y-2">
                {timelineSteps[activeStep].actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">User Experience</h4>
              <div className="bg-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={timelineSteps[activeStep].status === "warning" ? "secondary" : "destructive"}>
                    {timelineSteps[activeStep].access}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activeStep === 0 && "User sees countdown banner but can use all features normally."}
                  {activeStep === 1 && "Active sessions work, but new logins show 'Trial Expired' screen."}
                  {activeStep === 2 && "POS users see 'Contact Admin' message. Admin can still access billing."}
                  {activeStep === 3 && "Admin sees only the subscription/payment screen."}
                  {activeStep === 4 && "Account deleted. User must create new account to start over."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Path */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <RefreshCw className="w-5 h-5" />
            {recoveryPath.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{recoveryPath.description}</p>
          <div className="flex flex-wrap gap-2">
            {recoveryPath.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white">
                  {i + 1}. {step}
                </Badge>
                {i < recoveryPath.steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-green-600" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Offline POS Grace Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="w-5 h-5" />
            Offline POS Grace Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            For customers using the offline POS app, we provide a 48-hour grace period after license expiry 
            to prevent business disruption. This allows them to continue making sales while resolving payment issues.
          </p>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">48h</p>
                <p className="text-sm text-muted-foreground">Grace Period</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-500">Cached</p>
                <p className="text-sm text-muted-foreground">License Token</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-500">Syncs</p>
                <p className="text-sm text-muted-foreground">When Online</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
