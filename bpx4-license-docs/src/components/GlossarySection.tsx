import { useState } from "react";
import { motion } from "framer-motion";
import { Search, BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const glossaryTerms = [
  {
    term: "ARR",
    fullName: "Annual Recurring Revenue",
    category: "Metrics",
    definition: "The annualized value of all active subscriptions. Calculated as MRR × 12. Key metric for SaaS business health."
  },
  {
    term: "Billing Cycle",
    fullName: null,
    category: "Billing",
    definition: "The recurring period for which a customer is billed. Posibolt X supports monthly and annual billing cycles."
  },
  {
    term: "Billing Entity",
    fullName: null,
    category: "Billing",
    definition: "The legal company that issues invoices to customers. Posibolt has 4 entities: SA, UAE, KSA, and UAE (Export for International)."
  },
  {
    term: "Churn",
    fullName: null,
    category: "Metrics",
    definition: "When a customer cancels their subscription. Churn rate is the percentage of customers lost in a period."
  },
  {
    term: "Dunning",
    fullName: null,
    category: "Billing",
    definition: "The process of communicating with customers about failed payments and attempting to recover the revenue through retries and notifications."
  },
  {
    term: "Feature Gating",
    fullName: null,
    category: "Licensing",
    definition: "Restricting access to certain features based on the customer's subscription tier. Implemented at both API and UI levels."
  },
  {
    term: "Geo-targeting",
    fullName: null,
    category: "Pricing",
    definition: "Automatically detecting a user's location to show appropriate pricing, currency, and billing entity."
  },
  {
    term: "Grace Period",
    fullName: null,
    category: "Licensing",
    definition: "A period after license expiry where limited functionality continues. For offline POS, this is 48 hours."
  },
  {
    term: "Kill Bill",
    fullName: null,
    category: "Technical",
    definition: "Open-source subscription billing platform used by Posibolt X to manage subscriptions, trials, and billing cycles."
  },
  {
    term: "License Token",
    fullName: null,
    category: "Licensing",
    definition: "A cryptographic token that encodes the customer's subscription tier, features, and limits. Used for offline validation."
  },
  {
    term: "MRR",
    fullName: "Monthly Recurring Revenue",
    category: "Metrics",
    definition: "The predictable monthly revenue from all active subscriptions. Excludes one-time fees and usage charges."
  },
  {
    term: "Multi-tenancy",
    fullName: null,
    category: "Technical",
    definition: "Architecture where a single instance of software serves multiple customers (tenants), with data isolation between them."
  },
  {
    term: "NFR License",
    fullName: "Not For Resale",
    category: "Licensing",
    definition: "Free licenses given to partners for internal use, demos, and training. Cannot be used for production by end customers."
  },
  {
    term: "Overdue",
    fullName: null,
    category: "Billing",
    definition: "Status when a payment is past due. Triggers the dunning process with retries and notifications."
  },
  {
    term: "PLG",
    fullName: "Product-Led Growth",
    category: "Strategy",
    definition: "Growth strategy where the product itself drives customer acquisition through free trials and self-service signup."
  },
  {
    term: "Proration",
    fullName: null,
    category: "Billing",
    definition: "Adjusting charges when a customer upgrades or downgrades mid-cycle. Credits for unused time, charges for new tier."
  },
  {
    term: "RESTRICTED_PENDING",
    fullName: null,
    category: "Licensing",
    definition: "License status when trial expires. Existing sessions continue but new logins are blocked."
  },
  {
    term: "Revenue Recognition",
    fullName: null,
    category: "Accounting",
    definition: "The accounting principle of when to record revenue. For SaaS, revenue is recognized over the subscription period."
  },
  {
    term: "SaaS",
    fullName: "Software as a Service",
    category: "Technical",
    definition: "Software delivery model where applications are hosted in the cloud and accessed via subscription."
  },
  {
    term: "Subscription",
    fullName: null,
    category: "Billing",
    definition: "An ongoing agreement where a customer pays recurring fees for access to the software."
  },
  {
    term: "Tenant",
    fullName: null,
    category: "Technical",
    definition: "A customer's isolated instance within the multi-tenant system. Each tenant has their own data, users, and settings."
  },
  {
    term: "Trial",
    fullName: null,
    category: "Licensing",
    definition: "A time-limited period (14 days for Posibolt X) where users can access the product without payment."
  },
  {
    term: "Upgrade",
    fullName: null,
    category: "Billing",
    definition: "Moving from a lower tier to a higher tier. Takes effect immediately with prorated charges."
  },
  {
    term: "Downgrade",
    fullName: null,
    category: "Billing",
    definition: "Moving from a higher tier to a lower tier. Takes effect at the end of the current billing cycle."
  },
  {
    term: "VAT",
    fullName: "Value Added Tax",
    category: "Billing",
    definition: "Consumption tax added to invoices. Rate varies by billing entity: SA (15%), UAE (5%), KSA (15%)."
  },
  {
    term: "Webhook",
    fullName: null,
    category: "Technical",
    definition: "HTTP callback that notifies external systems of events. Kill Bill sends webhooks to Posibolt X Accounting for invoice generation."
  }
];

const categories = Array.from(new Set(glossaryTerms.map(t => t.category))).sort();

export default function GlossarySection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredTerms = glossaryTerms.filter(term => {
    const matchesSearch = searchQuery === "" || 
      term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      term.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (term.fullName && term.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === null || term.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedCategory === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms List */}
      <div className="grid gap-4">
        {filteredTerms.map((item, index) => (
          <motion.div
            key={item.term}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold">{item.term}</h3>
                      {item.fullName && (
                        <span className="text-sm text-muted-foreground">({item.fullName})</span>
                      )}
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.definition}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* No Results */}
      {filteredTerms.length === 0 && (
        <Card className="bg-secondary/50">
          <CardContent className="p-8 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No terms found matching your search.</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Reference */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Quick Reference: Key Formulas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-white rounded-lg">
              <p className="font-semibold mb-1">ARR Calculation</p>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded">ARR = MRR × 12</code>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="font-semibold mb-1">Churn Rate</p>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded">Churn = Lost Customers / Total Customers × 100</code>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="font-semibold mb-1">Annual Discount</p>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded">Annual Price = Monthly × 12 × 0.83 (17% off)</code>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="font-semibold mb-1">Proration</p>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded">Credit = (Days Left / Total Days) × Old Price</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
