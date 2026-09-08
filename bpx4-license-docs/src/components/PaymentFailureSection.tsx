import { useState } from "react";
import { motion } from "framer-motion";
import { 
  AlertTriangle, 
  CreditCard,
  Bell,
  TrendingDown,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Mail,
  MessageSquare,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const dunningStages = [
  {
    day: "T-7 to T-1",
    title: "Pre-Dunning",
    icon: Bell,
    color: "bg-blue-500",
    impact: "No Impact",
    communications: ["Email: Payment due reminder", "In-app notification"],
    systemActions: ["Card charged on due date", "Retry scheduled if fails"]
  },
  {
    day: "Day 1",
    title: "Initial Failure",
    icon: CreditCard,
    color: "bg-amber-500",
    impact: "Add-ons Disabled",
    communications: ["Email: Payment failed", "SMS notification", "In-app urgent banner"],
    systemActions: ["Non-core add-ons disabled", "Core POS still active", "Retry in 3 days"]
  },
  {
    day: "Day 7",
    title: "Feature Downgrade",
    icon: TrendingDown,
    color: "bg-orange-500",
    impact: "Downgrade to Lite",
    communications: ["Email: Final warning", "Phone call attempt", "In-app: Upgrade blocked"],
    systemActions: ["Auto-downgrade to Lite features", "Core POS basic only", "Last retry"]
  },
  {
    day: "Day 14",
    title: "Full Suspension",
    icon: XCircle,
    color: "bg-red-600",
    impact: "Account Suspended",
    communications: ["Email: Account suspended", "Final notice"],
    systemActions: ["All logins blocked", "Data retained 90 days", "Manual recovery only"]
  }
];

const retrySchedule = [
  { attempt: 1, timing: "Due date", method: "Primary card" },
  { attempt: 2, timing: "Day 3", method: "Primary card" },
  { attempt: 3, timing: "Day 7", method: "Primary card" },
  { attempt: 4, timing: "Day 10", method: "Backup card (if available)" },
];

export default function PaymentFailureSection() {
  const [activeStage, setActiveStage] = useState(0);

  return (
    <div className="space-y-8">
      {/* Overview */}
      <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Dunning: Recovering Failed Payments</h3>
              <p className="text-muted-foreground">
                When a payment fails, we don't immediately suspend the account. We follow a graduated 
                dunning process with multiple retry attempts and clear communication, maximizing recovery 
                while minimizing business disruption.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Timeline */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dunningStages.map((stage, index) => (
          <motion.div
            key={stage.day}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <button
              onClick={() => setActiveStage(index)}
              className="w-full h-full"
            >
              <Card className={`h-full transition-all ${
                activeStage === index 
                  ? "ring-2 ring-primary shadow-xl" 
                  : "hover:shadow-lg"
              }`}>
                <CardContent className="p-4">
                  <div className={`w-12 h-12 rounded-xl ${stage.color} flex items-center justify-center mb-3`}>
                    <stage.icon className="w-6 h-6 text-white" />
                  </div>
                  <Badge variant="outline" className="mb-2">{stage.day}</Badge>
                  <h3 className="font-semibold mb-2">{stage.title}</h3>
                  <Badge 
                    variant={index === 0 ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {stage.impact}
                  </Badge>
                </CardContent>
              </Card>
            </button>
          </motion.div>
        ))}
      </div>

      {/* Stage Details */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-xl ${dunningStages[activeStage].color} flex items-center justify-center`}>
              {(() => {
                const Icon = dunningStages[activeStage].icon;
                return <Icon className="w-6 h-6 text-white" />;
              })()}
            </div>
            <div>
              <Badge variant="outline" className="mb-1">{dunningStages[activeStage].day}</Badge>
              <h3 className="font-bold text-xl">{dunningStages[activeStage].title}</h3>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Communications
              </h4>
              <ul className="space-y-2">
                {dunningStages[activeStage].communications.map((comm, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{comm}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                System Actions
              </h4>
              <ul className="space-y-2">
                {dunningStages[activeStage].systemActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retry Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Automatic Retry Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Kill Bill automatically retries failed payments according to this schedule. 
            Each retry is logged and the customer is notified.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Attempt</th>
                  <th className="text-left py-3 px-4 font-semibold">Timing</th>
                  <th className="text-left py-3 px-4 font-semibold">Payment Method</th>
                </tr>
              </thead>
              <tbody>
                {retrySchedule.map((retry) => (
                  <tr key={retry.attempt} className="border-b hover:bg-secondary/50">
                    <td className="py-3 px-4">
                      <Badge variant="outline">#{retry.attempt}</Badge>
                    </td>
                    <td className="py-3 px-4">{retry.timing}</td>
                    <td className="py-3 px-4">{retry.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Options */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              Self-Service Recovery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              At any point, the customer can update their payment method and retry:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-green-600" />
                Log in to Posibolt X
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-green-600" />
                Go to Billing → Payment Methods
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-green-600" />
                Update card or add new payment method
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-green-600" />
                Click "Pay Now" to settle outstanding invoice
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-green-600" />
                Full access restored immediately
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <CreditCard className="w-5 h-5" />
              Legacy: Offline Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              For legacy customers using cheque/EFT:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-600" />
                Invoice sent via email with bank details
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-600" />
                Customer makes EFT/cheque payment
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-600" />
                Admin marks payment as received in portal
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-600" />
                License reactivated manually
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-600" />
                Reconciliation done in Posibolt X Accounting
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Dunning Best Practices (Industry Standard)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Communication</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Clear, non-threatening language</li>
                <li>• Multiple channels (email, SMS, in-app)</li>
                <li>• Easy one-click update payment link</li>
                <li>• Escalating urgency over time</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Timing</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Pre-dunning 7 days before due</li>
                <li>• Multiple retries over 14 days</li>
                <li>• Grace period before suspension</li>
                <li>• 90-day data retention</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Recovery</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Self-service payment update</li>
                <li>• Backup payment method support</li>
                <li>• Instant reactivation on payment</li>
                <li>• Win-back campaigns for churned</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
