import { VirginStyleHero } from "../components/VirginStyleHero";
import { RevenueGrowthChainSection } from "../components/RevenueGrowthChainSection";
import { WebsiteLayout } from "../layouts/WebsiteLayout";

import { ProofSection } from "../components/ProofSection";
import { GymOwnerWaitlistSection } from "../components/GymOwnerWaitlistSection";

const WebsiteHome = () => {
  return (
    <WebsiteLayout>
      <div id="top" />
      {/* Hero: main value prop - Virgin Active style */}
      <VirginStyleHero />
      {/* Revenue growth chain */}
      <RevenueGrowthChainSection />
      {/* What you get (owner + members) */}
      <ProofSection />
      {/* Gym Owner Waitlist */}
      <GymOwnerWaitlistSection />
    </WebsiteLayout>
  );
};

export default WebsiteHome;

