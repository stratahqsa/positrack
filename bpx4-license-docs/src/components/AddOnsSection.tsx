import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Calculator,
  ShoppingCart,
  Barcode,
  Truck,
  MessageSquare,
  CreditCard,
  BarChart3,
  Calendar,
  Lock,
} from "lucide-react";

export default function AddOnsSection() {
  const addOns = [
    {
      name: "mPOS",
      icon: Smartphone,
      description: "Mobile point of sale for floor sales, pop-ups, and events",
      pricing: "TBD",
      availability: "Growth+",
      status: "Phase 2",
    },
    {
      name: "Posibolt Accounting",
      icon: Calculator,
      description: "Full accounting module with GL, AP, AR, and financial reporting",
      pricing: "TBD",
      availability: "Pro",
      status: "Phase 2",
    },
    {
      name: "Marketplace Connectors",
      icon: ShoppingCart,
      description: "Sync with Takealot, Amazon, and other marketplaces",
      pricing: "TBD",
      availability: "Growth+",
      status: "Phase 2",
    },
    {
      name: "LabelX (RFID)",
      icon: Barcode,
      description: "RFID label design, encoding, and inventory management",
      pricing: "TBD",
      availability: "Pro",
      status: "Phase 2",
    },
    {
      name: "BoltB2B",
      icon: Truck,
      description: "Wholesale portal for B2B customers with credit management",
      pricing: "TBD",
      availability: "Pro",
      status: "Phase 2",
    },
    {
      name: "WhatsApp Commerce",
      icon: MessageSquare,
      description: "Order notifications, catalog sharing, and pay links via WhatsApp",
      pricing: "TBD",
      availability: "Growth+",
      status: "Phase 2",
    },
    {
      name: "Groworx Pay",
      icon: CreditCard,
      description: "Integrated payment processing with competitive rates",
      pricing: "Transaction fees",
      availability: "All tiers",
      status: "Phase 2",
    },
    {
      name: "Replenify",
      icon: BarChart3,
      description: "AI-powered demand forecasting and replenishment suggestions",
      pricing: "TBD",
      availability: "Pro",
      status: "Phase 2",
    },
  ];

  return (
    <section id="add-ons" className="py-20 bg-gradient-to-b from-slate-100 to-white">
      <div className="container max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-slate-200 text-slate-700 border-slate-300">
            Phase 2
          </Badge>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Add-Ons & Extensions
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Additional modules and integrations that extend Posibolt X capabilities.
            These are planned for Phase 2 of the product launch.
          </p>
        </div>

        {/* Phase 2 Notice */}
        <Card className="mb-12 border-2 border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-200 rounded-full">
                <Calendar className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Add-Ons are Phase 2
                </h3>
                <p className="text-slate-700">
                  The core Posibolt X launch (Phase 1) focuses on the Lite, Growth, and Pro tiers with 
                  essential POS, Products, Sales, Purchases, and basic reporting functionality. Add-ons 
                  will be introduced in Phase 2 once the core platform is stable and adopted.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add-Ons Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {addOns.map((addon, index) => (
            <Card key={index} className="border-slate-200 relative overflow-hidden opacity-75">
              {/* Phase 2 Overlay */}
              <div className="absolute top-2 right-2">
                <Badge className="bg-slate-700 text-white">
                  <Lock className="w-3 h-3 mr-1" />
                  Phase 2
                </Badge>
              </div>
              
              <CardContent className="p-6 pt-10">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                  <addon.icon className="w-6 h-6 text-slate-500" />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">{addon.name}</h4>
                <p className="text-slate-600 text-sm mb-4">{addon.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    <strong>Tier:</strong> {addon.availability}
                  </span>
                  <span className="text-slate-400">{addon.pricing}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pricing Note */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Add-on pricing will be determined based on market research and cost analysis during Phase 2 planning.
            Some add-ons may be included in higher tiers at no additional cost.
          </p>
        </div>
      </div>
    </section>
  );
}
