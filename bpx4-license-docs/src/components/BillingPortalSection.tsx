import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Users,
  Building2,
  CreditCard,
  FileText,
  Search,
  Filter,
  Download,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Edit,
  Mail,
  Phone,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Receipt,
  Banknote,
  Globe,
} from "lucide-react";

export default function BillingPortalSection() {
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedEntity, setSelectedEntity] = useState("all");

  // Mock data for the prototype
  const dashboardStats = {
    mrr: { value: "R 847,500", change: "+12.3%", trend: "up" },
    arr: { value: "R 10,170,000", change: "+15.7%", trend: "up" },
    activeSubscriptions: { value: "156", change: "+8", trend: "up" },
    churnRate: { value: "2.1%", change: "-0.3%", trend: "down" },
    trialConversions: { value: "68%", change: "+5%", trend: "up" },
    pendingPayments: { value: "R 45,200", change: "12 invoices", trend: "neutral" },
  };

  const recentSubscriptions = [
    {
      id: "SUB-001",
      company: "Cape Town Retail Co",
      plan: "Growth",
      mrr: "R 1,299",
      status: "Active",
      entity: "SA",
      paymentMethod: "Card",
      nextBilling: "2026-02-15",
    },
    {
      id: "SUB-002",
      company: "Dubai Fashion House",
      plan: "Pro",
      mrr: "AED 749",
      status: "Active",
      entity: "UAE",
      paymentMethod: "Card",
      nextBilling: "2026-02-10",
    },
    {
      id: "SUB-003",
      company: "Johannesburg Electronics",
      plan: "Growth",
      mrr: "R 1,299",
      status: "Payment Failed",
      entity: "SA",
      paymentMethod: "EFT",
      nextBilling: "Overdue",
    },
    {
      id: "SUB-004",
      company: "Riyadh Homeware",
      plan: "Growth",
      mrr: "SAR 499",
      status: "Trial",
      entity: "KSA",
      paymentMethod: "Pending",
      nextBilling: "Trial ends in 5 days",
    },
    {
      id: "SUB-005",
      company: "London Boutique Ltd",
      plan: "Pro",
      mrr: "$199",
      status: "Active",
      entity: "International",
      paymentMethod: "Card",
      nextBilling: "2026-02-20",
    },
    {
      id: "SUB-006",
      company: "Pretoria Hardware",
      plan: "Lite",
      mrr: "R 799",
      status: "Active",
      entity: "SA",
      paymentMethod: "Cheque",
      nextBilling: "2026-02-01",
    },
  ];

  const pendingInvoices = [
    {
      id: "INV-2026-0142",
      company: "Johannesburg Electronics",
      amount: "R 1,299",
      dueDate: "2026-01-15",
      status: "Overdue",
      daysOverdue: 6,
      entity: "SA",
    },
    {
      id: "INV-2026-0156",
      company: "Durban Clothing Store",
      amount: "R 2,598",
      dueDate: "2026-01-20",
      status: "Overdue",
      daysOverdue: 1,
      entity: "SA",
    },
    {
      id: "INV-2026-0167",
      company: "Abu Dhabi Retail",
      amount: "AED 1,498",
      dueDate: "2026-01-25",
      status: "Pending",
      daysOverdue: 0,
      entity: "UAE",
    },
  ];

  const legacyCustomers = [
    {
      id: "LEG-001",
      company: "Old Mutual Retail",
      currentPlan: "Legacy Enterprise",
      proposedPlan: "Pro",
      paymentMethod: "Cheque",
      monthlyValue: "R 4,500",
      status: "Migration Pending",
      notes: "Grandfathered pricing until 2027",
    },
    {
      id: "LEG-002",
      company: "Sandton Mall Group",
      currentPlan: "Legacy Pro",
      proposedPlan: "Growth",
      paymentMethod: "EFT",
      monthlyValue: "R 2,800",
      status: "In Discussion",
      notes: "Wants to keep offline payments",
    },
  ];

  const entityBreakdown = [
    { entity: "South Africa", code: "SA", currency: "ZAR", mrr: "R 425,000", customers: 89, color: "bg-green-500" },
    { entity: "UAE", code: "UAE", currency: "AED", mrr: "AED 185,000", customers: 34, color: "bg-blue-500" },
    { entity: "KSA", code: "KSA", currency: "SAR", mrr: "SAR 95,000", customers: 18, color: "bg-purple-500" },
    { entity: "International", code: "INT", currency: "USD", mrr: "$42,500", customers: 15, color: "bg-amber-500" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Active</Badge>;
      case "Trial":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Trial</Badge>;
      case "Payment Failed":
        return <Badge className="bg-red-100 text-red-700 border-red-300">Payment Failed</Badge>;
      case "Overdue":
        return <Badge className="bg-red-100 text-red-700 border-red-300">Overdue</Badge>;
      case "Pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-300">Pending</Badge>;
      case "Migration Pending":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-300">Migration Pending</Badge>;
      case "In Discussion":
        return <Badge className="bg-slate-100 text-slate-700 border-slate-300">In Discussion</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <section id="billing-portal" className="py-20 bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="container max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-emerald-900 text-emerald-300 border-emerald-700">
            Internal Tool Prototype
          </Badge>
          <h2 className="text-4xl font-bold text-white mb-4">
            Billing Portal
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            The internal dashboard for managing subscriptions, invoices, payments, and revenue across all entities.
            This is where your team sees the $$$.
          </p>
        </div>

        {/* Portal Prototype */}
        <Card className="border-slate-700 bg-slate-800 overflow-hidden">
          {/* Portal Header */}
          <div className="bg-slate-900 border-b border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Posibolt X Billing Portal</h3>
                  <p className="text-slate-400 text-sm">Subscription & Revenue Management</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <select 
                  className="bg-slate-700 text-white border-slate-600 rounded-lg px-3 py-2 text-sm"
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                >
                  <option value="all">All Entities</option>
                  <option value="SA">South Africa (ZAR)</option>
                  <option value="UAE">UAE (AED)</option>
                  <option value="KSA">KSA (SAR)</option>
                  <option value="INT">International (USD)</option>
                </select>
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  + New Subscription
                </button>
              </div>
            </div>
          </div>

          {/* Portal Navigation */}
          <div className="bg-slate-850 border-b border-slate-700">
            <div className="flex">
              {[
                { id: "dashboard", label: "Dashboard", icon: TrendingUp },
                { id: "subscriptions", label: "Subscriptions", icon: Users },
                { id: "invoices", label: "Invoices", icon: FileText },
                { id: "legacy", label: "Legacy Customers", icon: Building2 },
                { id: "payments", label: "Payment Methods", icon: CreditCard },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeView === tab.id
                      ? "text-emerald-400 border-emerald-400 bg-slate-800"
                      : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Portal Content */}
          <CardContent className="p-6 bg-slate-850">
            {activeView === "dashboard" && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: "MRR", ...dashboardStats.mrr, icon: DollarSign },
                    { label: "ARR", ...dashboardStats.arr, icon: TrendingUp },
                    { label: "Active Subs", ...dashboardStats.activeSubscriptions, icon: Users },
                    { label: "Churn Rate", ...dashboardStats.churnRate, icon: TrendingDown },
                    { label: "Trial Conv.", ...dashboardStats.trialConversions, icon: CheckCircle },
                    { label: "Pending", ...dashboardStats.pendingPayments, icon: Clock },
                  ].map((stat, index) => (
                    <div key={index} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs">{stat.label}</span>
                        <stat.icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <p className="text-xl font-bold text-white">{stat.value}</p>
                      <p className={`text-xs ${
                        stat.trend === "up" ? "text-emerald-400" : 
                        stat.trend === "down" ? "text-red-400" : "text-slate-400"
                      }`}>
                        {stat.change}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Entity Breakdown */}
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-white font-semibold mb-4">Revenue by Entity</h4>
                  <div className="grid md:grid-cols-4 gap-4">
                    {entityBreakdown.map((entity, index) => (
                      <div key={index} className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${entity.color}`}></div>
                          <span className="text-white font-medium">{entity.entity}</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{entity.mrr}</p>
                        <p className="text-slate-400 text-sm">{entity.customers} customers</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h4 className="text-white font-semibold">Recent Subscriptions</h4>
                    <button className="text-emerald-400 text-sm hover:underline">View All</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-750">
                        <tr>
                          <th className="text-left text-slate-400 text-xs font-medium p-3">Company</th>
                          <th className="text-left text-slate-400 text-xs font-medium p-3">Plan</th>
                          <th className="text-left text-slate-400 text-xs font-medium p-3">MRR</th>
                          <th className="text-left text-slate-400 text-xs font-medium p-3">Entity</th>
                          <th className="text-left text-slate-400 text-xs font-medium p-3">Payment</th>
                          <th className="text-left text-slate-400 text-xs font-medium p-3">Status</th>
                          <th className="text-left text-slate-400 text-xs font-medium p-3">Next Billing</th>
                          <th className="text-left text-slate-400 text-xs font-medium p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSubscriptions.map((sub) => (
                          <tr key={sub.id} className="border-t border-slate-700 hover:bg-slate-750">
                            <td className="p-3">
                              <p className="text-white font-medium">{sub.company}</p>
                              <p className="text-slate-500 text-xs">{sub.id}</p>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className={`
                                ${sub.plan === "Pro" ? "border-purple-500 text-purple-400" : ""}
                                ${sub.plan === "Growth" ? "border-blue-500 text-blue-400" : ""}
                                ${sub.plan === "Lite" ? "border-slate-500 text-slate-400" : ""}
                              `}>
                                {sub.plan}
                              </Badge>
                            </td>
                            <td className="p-3 text-white font-medium">{sub.mrr}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-slate-300 border-slate-600">
                                {sub.entity}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <span className="text-slate-300 text-sm flex items-center gap-1">
                                {sub.paymentMethod === "Card" && <CreditCard className="w-3 h-3" />}
                                {sub.paymentMethod === "EFT" && <Banknote className="w-3 h-3" />}
                                {sub.paymentMethod === "Cheque" && <Receipt className="w-3 h-3" />}
                                {sub.paymentMethod}
                              </span>
                            </td>
                            <td className="p-3">{getStatusBadge(sub.status)}</td>
                            <td className="p-3 text-slate-400 text-sm">{sub.nextBilling}</td>
                            <td className="p-3">
                              <button className="text-slate-400 hover:text-white">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeView === "subscriptions" && (
              <div className="space-y-4">
                {/* Search and Filters */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search subscriptions..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500"
                    />
                  </div>
                  <button className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-750">
                    <Filter className="w-4 h-4" />
                    Filters
                  </button>
                  <button className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-750">
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>

                {/* Subscription Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  {recentSubscriptions.map((sub) => (
                    <div key={sub.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-white font-semibold">{sub.company}</h4>
                          <p className="text-slate-500 text-sm">{sub.id}</p>
                        </div>
                        {getStatusBadge(sub.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-slate-500 text-xs">Plan</p>
                          <p className="text-white">{sub.plan}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">MRR</p>
                          <p className="text-white font-semibold">{sub.mrr}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Entity</p>
                          <p className="text-white">{sub.entity}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Payment Method</p>
                          <p className="text-white">{sub.paymentMethod}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-700">
                        <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded text-sm">
                          View Details
                        </button>
                        <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded text-sm">
                          Manage
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeView === "invoices" && (
              <div className="space-y-4">
                {/* Invoice Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-sm">Total Outstanding</p>
                    <p className="text-2xl font-bold text-white">R 45,200</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-sm">Overdue</p>
                    <p className="text-2xl font-bold text-red-400">R 3,897</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-sm">Due This Week</p>
                    <p className="text-2xl font-bold text-amber-400">R 12,450</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-sm">Paid This Month</p>
                    <p className="text-2xl font-bold text-emerald-400">R 847,500</p>
                  </div>
                </div>

                {/* Pending Invoices */}
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-4 border-b border-slate-700">
                    <h4 className="text-white font-semibold">Pending & Overdue Invoices</h4>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {pendingInvoices.map((invoice) => (
                      <div key={invoice.id} className="p-4 flex items-center justify-between hover:bg-slate-750">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-12 rounded-full ${
                            invoice.status === "Overdue" ? "bg-red-500" : "bg-amber-500"
                          }`}></div>
                          <div>
                            <p className="text-white font-medium">{invoice.company}</p>
                            <p className="text-slate-500 text-sm">{invoice.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold">{invoice.amount}</p>
                          <p className="text-slate-500 text-sm">Due: {invoice.dueDate}</p>
                        </div>
                        <div>
                          {getStatusBadge(invoice.status)}
                          {invoice.daysOverdue > 0 && (
                            <p className="text-red-400 text-xs mt-1">{invoice.daysOverdue} days overdue</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white">
                            <Mail className="w-4 h-4" />
                          </button>
                          <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white">
                            <Phone className="w-4 h-4" />
                          </button>
                          <button className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeView === "legacy" && (
              <div className="space-y-4">
                {/* Legacy Info Banner */}
                <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-6 h-6 text-purple-400 shrink-0" />
                    <div>
                      <h4 className="text-purple-300 font-semibold">Legacy Customer Management</h4>
                      <p className="text-purple-200/70 text-sm">
                        These are existing Posibolt Legacy customers being migrated to Posibolt X. 
                        They may have grandfathered pricing and offline payment methods (Cheque/EFT).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Legacy Customers Table */}
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h4 className="text-white font-semibold">Legacy Customers</h4>
                    <button className="text-emerald-400 text-sm hover:underline">+ Add Legacy Customer</button>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {legacyCustomers.map((customer) => (
                      <div key={customer.id} className="p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h5 className="text-white font-semibold">{customer.company}</h5>
                            <p className="text-slate-500 text-sm">{customer.id}</p>
                          </div>
                          {getStatusBadge(customer.status)}
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-slate-500 text-xs">Current Plan</p>
                            <p className="text-white">{customer.currentPlan}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Proposed Plan</p>
                            <p className="text-emerald-400">{customer.proposedPlan}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Payment Method</p>
                            <p className="text-white">{customer.paymentMethod}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Monthly Value</p>
                            <p className="text-white font-semibold">{customer.monthlyValue}</p>
                          </div>
                        </div>
                        <div className="bg-slate-750 rounded p-3">
                          <p className="text-slate-400 text-sm">
                            <strong className="text-slate-300">Notes:</strong> {customer.notes}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded text-sm">
                            View History
                          </button>
                          <button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded text-sm">
                            Start Migration
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeView === "payments" && (
              <div className="space-y-4">
                {/* Payment Methods Overview */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-900/50 rounded-lg">
                        <CreditCard className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">Card Payments</h4>
                        <p className="text-slate-400 text-sm">Stripe, Paystack, Payfort</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-white">78%</p>
                    <p className="text-slate-400 text-sm">of active subscriptions</p>
                  </div>
                  
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-900/50 rounded-lg">
                        <Banknote className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">EFT/Wire</h4>
                        <p className="text-slate-400 text-sm">Bank transfers</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-white">15%</p>
                    <p className="text-slate-400 text-sm">of active subscriptions</p>
                  </div>
                  
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-amber-900/50 rounded-lg">
                        <Receipt className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">Cheque</h4>
                        <p className="text-slate-400 text-sm">Legacy customers</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-white">7%</p>
                    <p className="text-slate-400 text-sm">of active subscriptions</p>
                  </div>
                </div>

                {/* Payment Gateway Status */}
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-4 border-b border-slate-700">
                    <h4 className="text-white font-semibold">Payment Gateway Status</h4>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {[
                      { name: "Paystack", region: "South Africa", status: "Active", transactions: "2,450", volume: "R 1.2M" },
                      { name: "Payfort", region: "UAE & KSA", status: "Active", transactions: "890", volume: "AED 450K" },
                      { name: "Stripe", region: "International", status: "Active", transactions: "320", volume: "$85K" },
                    ].map((gateway, index) => (
                      <div key={index} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                            <Globe className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{gateway.name}</p>
                            <p className="text-slate-500 text-sm">{gateway.region}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-white">{gateway.transactions}</p>
                            <p className="text-slate-500 text-xs">transactions/mo</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-semibold">{gateway.volume}</p>
                            <p className="text-slate-500 text-xs">volume/mo</p>
                          </div>
                          <Badge className="bg-emerald-900 text-emerald-300 border-emerald-700">
                            {gateway.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portal Features Explanation */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-emerald-900/50 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-white font-semibold mb-2">Revenue Visibility</h4>
              <p className="text-slate-400 text-sm">
                Real-time MRR, ARR, and revenue breakdown by entity. See exactly where your money is coming from.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-white font-semibold mb-2">Multi-Entity Support</h4>
              <p className="text-slate-400 text-sm">
                Manage SA, UAE, KSA, and International entities from one dashboard. Each with proper currency and tax handling.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center mb-4">
                <RefreshCw className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="text-white font-semibold mb-2">Legacy Migration</h4>
              <p className="text-slate-400 text-sm">
                Track and manage legacy customer migrations. Support for grandfathered pricing and offline payment methods.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
