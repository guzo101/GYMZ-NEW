import { AppDownloadBanner } from "../components/AppDownloadBanner";
import { VirginStyleHero } from "../components/VirginStyleHero";
import { KeyFeaturesSection } from "../components/KeyFeaturesSection";
import { VirtualTourSection } from "../components/VirtualTourSection";
import { WhyJoinSection } from "../components/WhyJoinSection";
import { FinalCTASection } from "../components/FinalCTASection";
import { ContactSection } from "../components/ContactSection";
import { OfferHighlights } from "../components/OfferHighlights";
import { WebsiteLayout } from "../layouts/WebsiteLayout";

import { LocationSection } from "../components/LocationSection";

const WebsiteHome = () => {
  return (
    <WebsiteLayout>
      <AppDownloadBanner />
      <div id="top" />
      {/* Hero: main value prop - Virgin Active style */}
      <VirginStyleHero />
      {/* Key Features/Highlights */}
      <KeyFeaturesSection />
      {/* Virtual Tour Section */}
      <VirtualTourSection />
      {/* Why Join Section */}
      <WhyJoinSection />
      {/* Pricing Section */}
      <OfferHighlights />
      {/* Contact Section */}
      <ContactSection />
      {/* Location Section */}
      <LocationSection />
      {/* Final CTA Section */}
      <FinalCTASection />
    </WebsiteLayout>
  );
};

export default WebsiteHome;

