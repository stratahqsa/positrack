import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Building2, 
  FileText, 
  ArrowRight,
  Globe,
  CreditCard,
  Receipt,
  CheckCircle2,
  AlertCircle,
  DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const entities = [
  {
    id: "za",
    name: "Posibolt SA (Pty) Ltd",
    country: "South Africa",
    flag: "🇿🇦",
    currency: "ZAR",
    taxAuthority: "SARS",
    taxRate: "15%",
    invoiceType: "Local Tax Invoice",
    bankDetails: "FNB South Africa",
    serves: ["South Africa", "Botswana", "Namibia", "Zimbabwe"]
  },
  {
    id: "ae",
    name: "Posibolt UAE LLC",
    country: "UAE",
    flag: "🇦🇪",
    currency: "AED",
    taxAuthority: "FTA",
    taxRate: "5%",
    invoiceType: "Local Tax Invoice",
    bankDetails: "Emirates NBD",
    serves: ["UAE", "Bahrain", "Oman", "Qatar"]
  },
  {
    id: "sa",
    name: "Posibolt KSA",
    country: "Saudi Arabia",
    flag: "🇸🇦",
    currency: "SAR",
    taxAuthority: "ZATCA",
    taxRate: "15%",
    invoiceType: "ZATCA Compliant Invoice",
    bankDetails: "Al Rajhi Bank",
    serves: ["Saudi Arabia"]
  },
  {
    id: "int",
    name: "Posibolt UAE LLC (Export)",
    country: "UAE",
    flag: "🌍",
    currency: "USD",
    taxAuthority: "N/A",
    taxRate: "0%",
    invoiceType: "Export Invoice",
    bankDetails: "Emirates NBD (USD)",
    serves: ["All other countries"]
  }
];

export default function EntityBillingSection() {
  const [activeEntity, setActiveEntity] = useState("za");
  const entity = entities.find(e => e.id === activeEntity)!;

  return (
    <div className="space-y-8">
      {/* The Big Picture */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            The Multi-Entity Billing Model
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground mb-6">
            Posibolt operates through 4 legal entities to ensure tax compliance and local payment processing. 
            The billing entity is determined automatically based on the customer's location.
          </p>
          
          {/* Visual Flow */}
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="grid md:grid-cols-5 gap-4 items-center">
              {/* Customer */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                  <Globe className="w-8 h-8 text-blue-600" />
                </div>
                <p className="font-semibold text-sm">Customer</p>
                <p className="text-xs text-muted-foreground">Any Location</p>
              </div>

              <ArrowRight className="w-6 h-6 text-muted-foreground mx-auto hidden md:block" />

              {/* Geo Detection */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">📍</span>
                </div>
                <p className="font-semibold text-sm">Geo Detection</p>
                <p className="text-xs text-muted-foreground">IP → Region</p>
              </div>

              <ArrowRight className="w-6 h-6 text-muted-foreground mx-auto hidden md:block" />

              {/* Entity Selection */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-sm">Billing Entity</p>
                <p className="text-xs text-muted-foreground">Auto-selected</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity Selector */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Entity Cards */}
        <div className="lg:col-span-1 space-y-3">
          {entities.map((e) => (
            <motion.button
              key={e.id}
              onClick={() => setActiveEntity(e.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                activeEntity === e.id 
                  ? "border-primary bg-primary/5 shadow-md" 
                  : "border-border bg-white hover:border-primary/50"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{e.flag}</span>
                <div>
                  <p className="font-semibold">{e.name}</p>
                  <p className="text-sm text-muted-foreground">{e.currency}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Entity Details */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">{entity.flag}</span>
              <div>
                <h3 className="font-bold text-xl">{entity.name}</h3>
                <p className="text-muted-foreground">{entity.country}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Currency</p>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {entity.currency}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tax Authority</p>
                  <p className="font-semibold">{entity.taxAuthority}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tax Rate</p>
                  <p className="font-semibold">{entity.taxRate}</p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Invoice Type</p>
                  <p className="font-semibold">{entity.invoiceType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Bank</p>
                  <p className="font-semibold">{entity.bankDetails}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Serves</p>
                  <div className="flex flex-wrap gap-1">
                    {entity.serves.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Generation Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoice Generation Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-blue-600">1</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Kill Bill Triggers Invoice</h4>
                <p className="text-sm text-muted-foreground">
                  At billing cycle end, Kill Bill generates an invoice event with subscription details, 
                  tenant ID, and amount in the tenant's currency.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-purple-600">2</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Entity Resolution</h4>
                <p className="text-sm text-muted-foreground">
                  Posibolt X Accounting receives the event and looks up the tenant's region 
                  to determine which legal entity should issue the invoice.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-green-600">3</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Tax Calculation</h4>
                <p className="text-sm text-muted-foreground">
                  Based on the entity, the system applies the correct tax rate and generates 
                  a compliant invoice (local tax invoice or export invoice).
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-amber-600">4</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Invoice Delivery</h4>
                <p className="text-sm text-muted-foreground">
                  Invoice is stored in Posibolt X Accounting, visible in the customer's billing 
                  portal, and sent via email. PDF available for download.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legacy Customer Handling */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Legacy Customer Migration</h3>
              <p className="text-muted-foreground mb-4">
                Existing Posibolt Legacy customers will be migrated manually with special handling:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span><strong>Grandfathered pricing</strong> – Existing rates honored</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span><strong>Offline payments</strong> – Cheque/EFT continues to be supported</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span><strong>Skip trial</strong> – Direct to paid plan based on current subscription</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span><strong>Manual portal</strong> – Admin interface for managing offline payments</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posibolt X Accounting Module */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Posibolt X Accounting Module (To Be Built)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            A backend module that handles all invoicing and revenue recognition. This is separate from 
            Kill Bill (which handles subscriptions) and the payment gateways (which handle payments).
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Core Responsibilities</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  Invoice generation from Kill Bill events
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  Entity resolution based on tenant region
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  Tax calculation per entity rules
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  Invoice numbering sequences per entity
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  PDF generation with entity branding
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Revenue Recognition</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  MRR/ARR tracking per entity
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Currency conversion for reporting
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Deferred revenue handling
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Inter-company reconciliation
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Export to external accounting systems
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
