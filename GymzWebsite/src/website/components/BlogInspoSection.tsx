import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const tabs = ["Latest", "Training", "Nutrition", "Mindset"];

const featuredArticle = {
  category: "TRAINING",
  title: "3 Things That Matter for Fat Loss",
  description: "The essentials for losing fat and keeping it off.",
  href: "#article",
};

const articles = [
  {
    category: "NUTRITION",
    title: "Protein: How Much Is Enough?",
    href: "#protein",
  },
  {
    category: "MINDSET",
    title: "Why Motivation Fails (And What Works Instead)",
    href: "#mindset",
  },
];

export function BlogInspoSection() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="bg-gradient-to-br from-gray-50 via-primary/30 to-secondary/20 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Articles
            </h2>
          </div>
          <Button
            variant="ghost"
            className="hidden md:flex"
            asChild
          >
            <a href="#blog">
              Read All Articles <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mb-12 border-b border-gray-200">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`pb-4 text-sm font-medium transition-colors ${
                idx === activeTab
                  ? "text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Featured Article */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-8 hover:shadow-xl transition-all group cursor-pointer">
            <span className="text-xs font-semibold text-[hsl(var(--primary))] uppercase tracking-wider mb-4 block">
              {featuredArticle.category}
            </span>
            <h3 className="text-3xl font-bold mb-4">{featuredArticle.title}</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              {featuredArticle.description}
            </p>
            <a
              href={featuredArticle.href}
              className="text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors inline-flex items-center gap-2 font-semibold"
            >
              Read Article <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Side Articles */}
          <div className="space-y-6">
            {articles.map((article, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all group cursor-pointer"
              >
                <span className="text-xs font-semibold text-[hsl(var(--primary))] uppercase tracking-wider mb-3 block">
                  {article.category}
                </span>
                <h4 className="text-xl font-bold mb-4">{article.title}</h4>
                <a
                  href={article.href}
                  className="text-muted-foreground hover:text-[hsl(var(--primary))] transition-colors inline-flex items-center gap-2 text-sm font-semibold uppercase"
                >
                  READ MORE <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
