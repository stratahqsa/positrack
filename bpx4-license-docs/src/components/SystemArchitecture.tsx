import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Database, 
  Server,
  CreditCard,
  FileText,
  Users,
  ArrowRight,
  ArrowDown,
  Zap,
  Globe,
  Shield,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const systemComponents = [
  {
    id: "killbill",
    name: "Kill Bill",
    type: "Subscription Engine",
    icon: RefreshCw,
    color: "bg-purple-500",
    description: "Open-source subscription billing platform",
    responsibilities: [
      "Subscription lifecycle management",
      "Plan/tier definitions",
      "Trial management",
      "Billing cycle automation",
      "Invoice generation triggers",
      "Payment retry logic"
    ],
    integrations: ["Posibolt X Core", "Payment Gateways", "Posibolt X Accounting"]
  },
  {
    id: "accounting",
    name: "Posibolt X Accounting",
    type: "Invoice & Revenue Module",
    icon: FileText,
    color: "bg-green-500",
    description: "Internal module for invoicing and revenue recognition",
    responsibilities: [
      "Invoice generation from Kill Bill events",
      "Entity resolution (SA/UAE/KSA/International)",
      "Tax calculation per entity",
      "PDF invoice generation",
      "Revenue recognition",
      "Inter-company reconciliation"
    ],
    integrations: ["Kill Bill", "Posibolt X Core", "External Accounting"]
  },
  {
    id: "gateways",
    name: "Payment Gateways",
    type: "Payment Processing",
    icon: CreditCard,
    color: "bg-blue-500",
    description: "Regional payment processors",
    responsibilities: [
      "Card tokenization",
      "Payment processing",
      "Recurring billing",
      "Refund handling",
      "PCI compliance"
    ],
    integrations: ["Kill Bill", "Posibolt X Core"]
  },
  {
    id: "licensing",
    name: "Licensing Service",
    type: "Access Control",
    icon: Shield,
    color: "bg-amber-500",
    description: "Feature gating and license management",
    responsibilities: [
      "License token generation",
      "Feature flag management",
      "Tier-based access control",
      "Offline license validation",
      "Usage tracking"
    ],
    integrations: ["Kill Bill", "Posibolt X Core", "Posibolt X Apps"]
  }
];

const dataFlows = [
  {
    from: "User",
    to: "Posibolt X",
    action: "Signs up",
    data: "Email, Company, Region"
  },
  {
    from: "Posibolt X",
    to: "Kill Bill",
    action: "Creates subscription",
    data: "Tenant ID, Plan, Trial dates"
  },
  {
    from: "Kill Bill",
    to: "Licensing",
    action: "Issues license",
    data: "License token, Features, Limits"
  },
  {
    from: "User",
    to: "Posibolt X",
    action: "Clicks Upgrade",
    data: "Selected plan"
  },
  {
    from: "Posibolt X",
    to: "Gateway",
    action: "Processes payment",
    data: "Card details, Amount"
  },
  {
    from: "Gateway",
    to: "Kill Bill",
    action: "Confirms payment",
    data: "Transaction ID, Status"
  },
  {
    from: "Kill Bill",
    to: "Accounting",
    action: "Triggers invoice",
    data: "Subscription details, Amount"
  },
  {
    from: "Accounting",
    to: "User",
    action: "Sends invoice",
    data: "PDF invoice, Email"
  }
];

export default function SystemArchitecture() {
  const [activeComponent, setActiveComponent] = useState<string | null>("killbill");

  const component = systemComponents.find(c => c.id === activeComponent);

  return (
    <div className="space-y-8">
      {/* Architecture Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>System Architecture Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 rounded-2xl p-8">
            {/* Top Row: User & Posibolt X */}
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-2">
                    <Users className="w-10 h-10 text-slate-600" />
                  </div>
                  <p className="font-semibold">User</p>
                  <p className="text-xs text-muted-foreground">Web/Mobile</p>
                </div>
                <ArrowRight className="w-8 h-8 text-slate-400" />
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-2">
                    <Zap className="w-10 h-10 text-white" />
                  </div>
                  <p className="font-semibold">Posibolt X</p>
                  <p className="text-xs text-muted-foreground">Core Application</p>
                </div>
              </div>
            </div>

            <ArrowDown className="w-8 h-8 text-slate-400 mx-auto mb-4" />

            {/* Middle Row: Core Services */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {systemComponents.map((comp) => (
                <motion.button
                  key={comp.id}
                  onClick={() => setActiveComponent(comp.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    activeComponent === comp.id
                      ? "border-primary bg-white shadow-lg"
                      : "border-border bg-white hover:border-primary/50"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`w-12 h-12 rounded-xl ${comp.color} flex items-center justify-center mx-auto mb-2`}>
                    <comp.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="font-semibold text-sm">{comp.name}</p>
                  <p className="text-xs text-muted-foreground">{comp.type}</p>
                </motion.button>
              ))}
            </div>

            {/* Bottom Row: External */}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-slate-300 flex items-center justify-center mx-auto mb-2">
                  <Database className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-sm font-medium">Database</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-slate-300 flex items-center justify-center mx-auto mb-2">
                  <Globe className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-sm font-medium">External APIs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Details */}
      {component && (
        <motion.div
          key={component.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-xl ${component.color} flex items-center justify-center`}>
                  <component.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">{component.name}</h3>
                  <p className="text-muted-foreground">{component.type}</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-6">{component.description}</p>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Responsibilities</h4>
                  <ul className="space-y-2">
                    {component.responsibilities.map((resp, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {resp}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Integrates With</h4>
                  <div className="flex flex-wrap gap-2">
                    {component.integrations.map((int, i) => (
                      <Badge key={i} variant="outline">{int}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Data Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Data Flow: Signup to Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dataFlows.map((flow, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                  {index + 1}
                </Badge>
                <div className="flex items-center gap-2 min-w-[200px]">
                  <Badge variant="secondary">{flow.from}</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="secondary">{flow.to}</Badge>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{flow.action}</p>
                  <p className="text-xs text-muted-foreground">{flow.data}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Kill Bill Integration Details */}
      <Card className="bg-purple-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <RefreshCw className="w-5 h-5" />
            Kill Bill Integration Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Why Kill Bill?</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span>Open-source, battle-tested subscription billing</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span>Supports complex billing scenarios</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span>Plugin architecture for customization</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span>Multi-tenancy support built-in</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Key Configurations</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span><strong>Catalog:</strong> Lite, Growth, Pro, Enterprise plans</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span><strong>Overdue:</strong> 14-day dunning with 4 retries</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span><strong>Plugins:</strong> Paystack, Payfort, Stripe</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5" />
                  <span><strong>Events:</strong> Webhook to Posibolt X Accounting</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
