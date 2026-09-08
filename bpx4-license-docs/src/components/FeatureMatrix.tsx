import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Check, 
  X, 
  Lock,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const featureCategories = [
  {
    name: "Core POS",
    features: [
      { name: "Point of Sale", lite: true, growth: true, pro: true, enterprise: true },
      { name: "Product Management", lite: true, growth: true, pro: true, enterprise: true },
      { name: "Customer Management", lite: true, growth: true, pro: true, enterprise: true },
      { name: "Basic Reports", lite: true, growth: true, pro: true, enterprise: true },
      { name: "Receipt Printing", lite: true, growth: true, pro: true, enterprise: true },
    ]
  },
  {
    name: "Locations & Registers",
    features: [
      { name: "Locations", lite: "1", growth: "Up to 10", pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Registers per Location", lite: "1", growth: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Multi-store Sync", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Centralized Inventory", lite: false, growth: true, pro: true, enterprise: true },
    ]
  },
  {
    name: "Advanced Features",
    features: [
      { name: "Order Management (OMS)", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Advanced Purchasing", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Supplier Management", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Stock Transfers", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Promotions Engine", lite: false, growth: "Basic", pro: "Advanced", enterprise: "Advanced" },
    ]
  },
  {
    name: "AI & Automation",
    features: [
      { name: "AI Copilot", lite: false, growth: "Basic", pro: "Full", enterprise: "Full + Custom" },
      { name: "AI Product Import", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Demand Forecasting", lite: false, growth: false, pro: true, enterprise: true },
      { name: "Auto Reorder Suggestions", lite: false, growth: false, pro: true, enterprise: true },
      { name: "Anomaly Detection", lite: false, growth: false, pro: true, enterprise: true },
    ]
  },
  {
    name: "Accounting & Finance",
    features: [
      { name: "Basic Accounting", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Advanced Accounting", lite: false, growth: false, pro: true, enterprise: true },
      { name: "Multi-currency", lite: false, growth: false, pro: true, enterprise: true },
      { name: "Financial Reports", lite: false, growth: "Basic", pro: "Advanced", enterprise: "Custom" },
      { name: "Audit Trail", lite: false, growth: true, pro: true, enterprise: true },
    ]
  },
  {
    name: "Integrations",
    features: [
      { name: "Shopify Sync", lite: false, growth: true, pro: true, enterprise: true },
      { name: "WooCommerce Sync", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Marketplace Channels", lite: false, growth: false, pro: true, enterprise: true },
      { name: "API Access", lite: false, growth: "Limited", pro: "Full", enterprise: "Full + Webhooks" },
      { name: "Custom Integrations", lite: false, growth: false, pro: false, enterprise: true },
    ]
  },
  {
    name: "Users & Security",
    features: [
      { name: "User Roles", lite: "3", growth: "5", pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Custom Roles", lite: false, growth: false, pro: true, enterprise: true },
      { name: "Approval Workflows", lite: false, growth: false, pro: true, enterprise: true },
      { name: "SSO/SAML", lite: false, growth: false, pro: false, enterprise: true },
      { name: "IP Whitelisting", lite: false, growth: false, pro: false, enterprise: true },
    ]
  },
  {
    name: "Support",
    features: [
      { name: "Email Support", lite: true, growth: true, pro: true, enterprise: true },
      { name: "Chat Support", lite: false, growth: true, pro: true, enterprise: true },
      { name: "Phone Support", lite: false, growth: false, pro: true, enterprise: true },
      { name: "Dedicated Account Manager", lite: false, growth: false, pro: false, enterprise: true },
      { name: "SLA Guarantee", lite: false, growth: false, pro: false, enterprise: true },
    ]
  }
];

const plans = [
  { id: "lite", name: "Lite", color: "bg-slate-500" },
  { id: "growth", name: "Growth", color: "bg-purple-500", badge: "Trial Default" },
  { id: "pro", name: "Pro", color: "bg-blue-500" },
  { id: "enterprise", name: "Enterprise", color: "bg-amber-500" },
];

export default function FeatureMatrix() {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["Core POS", "Locations & Registers"]);

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => 
      prev.includes(name) 
        ? prev.filter(c => c !== name)
        : [...prev, name]
    );
  };

  const renderValue = (value: boolean | string) => {
    if (value === true) {
      return <Check className="w-5 h-5 text-green-500 mx-auto" />;
    }
    if (value === false) {
      return <X className="w-5 h-5 text-slate-300 mx-auto" />;
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Feature Gating Explanation */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Feature Gating Implementation</h3>
              <p className="text-muted-foreground mb-4">
                Features are gated at both the <strong>API level</strong> and <strong>UI level</strong>:
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white rounded-lg p-3">
                  <p className="font-semibold mb-1">API Level</p>
                  <p className="text-muted-foreground">
                    Backend checks license token before allowing access to endpoints. 
                    Returns 403 with upgrade prompt for restricted features.
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="font-semibold mb-1">UI Level</p>
                  <p className="text-muted-foreground">
                    Pro features show <Lock className="w-3 h-3 inline" /> icon with tooltip: 
                    "Upgrade to Pro to unlock this feature"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Headers */}
      <div className="sticky top-16 z-20 bg-background py-4">
        <div className="grid grid-cols-5 gap-2">
          <div className="font-semibold text-sm">Feature</div>
          {plans.map((plan) => (
            <div key={plan.id} className="text-center">
              <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${plan.color} text-white text-sm font-medium`}>
                {plan.name}
                {plan.badge && (
                  <Badge variant="secondary" className="text-xs ml-1 bg-white/20 text-white">
                    {plan.badge}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Categories */}
      <div className="space-y-4">
        {featureCategories.map((category) => (
          <Card key={category.name}>
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full"
            >
              <CardHeader className="py-3 px-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  {expandedCategories.includes(category.name) ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </button>
            
            {expandedCategories.includes(category.name) && (
              <CardContent className="pt-0 pb-4">
                <div className="space-y-2">
                  {category.features.map((feature, index) => (
                    <motion.div
                      key={feature.name}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="grid grid-cols-5 gap-2 py-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="text-sm">{feature.name}</div>
                      <div className="text-center">{renderValue(feature.lite)}</div>
                      <div className="text-center">{renderValue(feature.growth)}</div>
                      <div className="text-center">{renderValue(feature.pro)}</div>
                      <div className="text-center">{renderValue(feature.enterprise)}</div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Expand/Collapse All */}
      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandedCategories(featureCategories.map(c => c.name))}
        >
          Expand All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandedCategories([])}
        >
          Collapse All
        </Button>
      </div>

      {/* Add-ons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Add-ons (Available on Growth+)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-secondary/50">
              <h4 className="font-semibold mb-1">mPOS App</h4>
              <p className="text-sm text-muted-foreground mb-2">Mobile point of sale for on-the-go sales</p>
              <Badge variant="outline">+R299/mo per device</Badge>
            </div>
            <div className="p-4 rounded-xl bg-secondary/50">
              <h4 className="font-semibold mb-1">LabelX (RFID)</h4>
              <p className="text-sm text-muted-foreground mb-2">RFID inventory management</p>
              <Badge variant="outline">+R499/mo</Badge>
            </div>
            <div className="p-4 rounded-xl bg-secondary/50">
              <h4 className="font-semibold mb-1">BoltB2B</h4>
              <p className="text-sm text-muted-foreground mb-2">B2B ordering portal for wholesale</p>
              <Badge variant="outline">+R399/mo</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
