import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Zap, 
  Menu, 
  X,
  ChevronDown,
  BookOpen,
  Map,
  Building2,
  Layers,
  Clock,
  AlertTriangle,
  Grid3X3,
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  Package,
  Handshake,
  ClipboardCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "readiness", label: "Readiness", icon: ClipboardCheck },
  { id: "customer-journey", label: "Customer Journey", icon: Map },
  { id: "why-growth", label: "Why Growth?", icon: TrendingUp },
  { id: "pricing", label: "Pricing & Geo", icon: Building2 },
  { id: "entity-billing", label: "Entity Billing", icon: FileText },
  { id: "billing-portal", label: "Billing Portal", icon: DollarSign },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "trial-expiry", label: "Trial Expiry", icon: Clock },
  { id: "payment-failure", label: "Payment Failure", icon: AlertTriangle },
  { id: "features", label: "Feature Matrix", icon: Grid3X3 },
  { id: "add-ons", label: "Add-Ons", icon: Package },
  { id: "partner-program", label: "Partner Program", icon: Handshake },
  { id: "glossary", label: "Glossary", icon: FileText },
];

export default function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      onSectionChange(id);
    }
    setMobileOpen(false);
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-border" 
          : "bg-transparent"
      }`}
    >
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">Posibolt X</p>
              <p className="text-xs text-muted-foreground leading-tight">Licensing Docs</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.slice(0, 6).map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection(item.id)}
                className={`text-sm ${
                  activeSection === item.id 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Button>
            ))}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="text-sm text-muted-foreground">
                More <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
              <div className="absolute top-full right-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-white rounded-xl shadow-xl border border-border p-2 min-w-[200px]">
                  {navItems.slice(6).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors text-left"
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <div className="flex flex-col gap-2 mt-8">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                      activeSection === item.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}
