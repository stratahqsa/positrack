import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Globe, 
  MapPin, 
  Check,
  Lock,
  Sparkles,
  Building2,
  ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const regions = [
  { id: "za", name: "South Africa", currency: "ZAR", symbol: "R", flag: "🇿🇦", gateway: "Paystack" },
  { id: "ae", name: "UAE", currency: "AED", symbol: "AED", flag: "🇦🇪", gateway: "Payfort" },
  { id: "sa", name: "KSA", currency: "SAR", symbol: "SAR", flag: "🇸🇦", gateway: "Payfort" },
  { id: "int", name: "International", currency: "USD", symbol: "$", flag: "🌍", gateway: "Stripe" },
];

const pricing = {
  za: { lite: 799, growth: 1299, pro: 1999, enterprise: "Custom" },
  ae: { lite: 299, growth: 499, pro: 799, enterprise: "Custom" },
  sa: { lite: 299, growth: 499, pro: 799, enterprise: "Custom" },
  int: { lite: 79, growth: 129, pro: 199, enterprise: "Custom" },
};

const plans = [
  {
    id: "lite",
    name: "Lite",
    description: "Essential POS for single-location retailers",
    features: ["1 Location", "1 Register", "Basic POS", "Standard Reports", "3 User Roles"],
    highlight: false
  },
  {
    id: "growth",
    name: "Growth",
    description: "For growing retailers with multiple locations",
    features: ["Up to 10 Locations", "Unlimited Registers", "AI Copilot (Basic)", "OMS", "5 User Roles", "Shopify Sync"],
    highlight: true,
    badge: "14-Day Free Trial"
  },
  {
    id: "pro",
    name: "Pro",
    description: "Advanced features for established retailers",
    features: ["Unlimited Locations", "Full AI Copilot", "Advanced Accounting", "Approval Workflows", "Unlimited Roles", "Multi-store Sync"],
    highlight: false
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large retailers",
    features: ["Everything in Pro", "Dedicated Support", "Custom Integrations", "SLA Guarantees", "Advanced RBAC", "On-premise Option"],
    highlight: false
  }
];

export default function PricingSection() {
  const [selectedRegion, setSelectedRegion] = useState("za");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const region = regions.find(r => r.id === selectedRegion)!;
  const prices = pricing[selectedRegion as keyof typeof pricing];

  const getPrice = (planId: string) => {
    const basePrice = prices[planId as keyof typeof prices];
    if (typeof basePrice === "string") return basePrice;
    if (billingCycle === "annual") {
      return Math.round(basePrice * 0.83); // 17% discount
    }
    return basePrice;
  };

  return (
    <div className="space-y-8">
      {/* How It Works */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">How Geo-Targeting Works</h3>
              <p className="text-muted-foreground mb-4">
                When a user visits posibolt.ai, we detect their location via IP geolocation. 
                The pricing page automatically shows prices in their local currency with the 
                appropriate billing entity. Users can manually change their region if needed.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">IP Detection</Badge>
                <Badge variant="outline">Auto Currency</Badge>
                <Badge variant="outline">Manual Override</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Region Selector - Like Lightspeed */}
      <div className="bg-white rounded-2xl shadow-lg border border-border p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-xl mb-1">Select Your Region</h3>
            <p className="text-sm text-muted-foreground">Pricing adjusts based on your location</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Region Dropdown */}
            <div className="relative">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="appearance-none bg-secondary rounded-xl px-4 py-3 pr-10 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.flag} {r.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center bg-secondary rounded-xl p-1">
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingCycle === "annual" 
                    ? "bg-white shadow text-foreground" 
                    : "text-muted-foreground"
                }`}
              >
                Annual (save 17%)
              </button>
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingCycle === "monthly" 
                    ? "bg-white shadow text-foreground" 
                    : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl border-2 p-6 transition-all ${
                plan.highlight 
                  ? "border-primary bg-primary/5 shadow-lg" 
                  : "border-border bg-white hover:border-primary/50"
              }`}
            >
              {plan.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  {plan.badge}
                </Badge>
              )}
              
              <div className="text-center mb-4">
                <h4 className="font-bold text-lg">{plan.name}</h4>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">
                    {typeof getPrice(plan.id) === "number" 
                      ? `${region.symbol}${getPrice(plan.id)}` 
                      : getPrice(plan.id)}
                  </span>
                  {typeof getPrice(plan.id) === "number" && (
                    <span className="text-muted-foreground">/mo</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {region.currency} • via {region.gateway}
                </p>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full" 
                variant={plan.highlight ? "default" : "outline"}
              >
                {plan.id === "enterprise" ? "Contact Sales" : "Start Free Trial"}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Region to Entity Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Region → Entity Mapping
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">User Location</th>
                  <th className="text-left py-3 px-4 font-semibold">Currency</th>
                  <th className="text-left py-3 px-4 font-semibold">Billing Entity</th>
                  <th className="text-left py-3 px-4 font-semibold">Payment Gateway</th>
                  <th className="text-left py-3 px-4 font-semibold">Tax Compliance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-secondary/50">
                  <td className="py-3 px-4">🇿🇦 South Africa</td>
                  <td className="py-3 px-4"><Badge variant="outline">ZAR</Badge></td>
                  <td className="py-3 px-4">Posibolt SA (Pty) Ltd</td>
                  <td className="py-3 px-4">Paystack</td>
                  <td className="py-3 px-4">SARS VAT</td>
                </tr>
                <tr className="border-b hover:bg-secondary/50">
                  <td className="py-3 px-4">🇦🇪 UAE</td>
                  <td className="py-3 px-4"><Badge variant="outline">AED</Badge></td>
                  <td className="py-3 px-4">Posibolt UAE LLC</td>
                  <td className="py-3 px-4">Payfort</td>
                  <td className="py-3 px-4">FTA VAT</td>
                </tr>
                <tr className="border-b hover:bg-secondary/50">
                  <td className="py-3 px-4">🇸🇦 KSA</td>
                  <td className="py-3 px-4"><Badge variant="outline">SAR</Badge></td>
                  <td className="py-3 px-4">Posibolt KSA</td>
                  <td className="py-3 px-4">Payfort</td>
                  <td className="py-3 px-4">ZATCA VAT</td>
                </tr>
                <tr className="hover:bg-secondary/50">
                  <td className="py-3 px-4">🌍 All Other Countries</td>
                  <td className="py-3 px-4"><Badge variant="outline">USD</Badge></td>
                  <td className="py-3 px-4">Posibolt UAE LLC (Export)</td>
                  <td className="py-3 px-4">Stripe</td>
                  <td className="py-3 px-4">Export Invoice</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Why Growth First */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Why Start with Growth Trial?</h3>
              <p className="text-muted-foreground mb-4">
                We default new users to a 14-day Growth trial (not Lite) because:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5" />
                  <span><strong>Higher perceived value</strong> – Users experience AI features, multi-location, and advanced tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5" />
                  <span><strong>Better conversion</strong> – Users who experience Growth features are more likely to pay for them</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5" />
                  <span><strong>Loss aversion</strong> – Pro features show <Lock className="w-3 h-3 inline" /> badges, creating desire to upgrade</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5" />
                  <span><strong>AI recommendations</strong> – System can suggest right tier based on actual usage</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
