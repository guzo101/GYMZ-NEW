import { useEffect } from "react";
import { Link } from "react-router-dom";
import { WebsiteLayout } from "../layouts/WebsiteLayout";
import { ArrowLeft } from "lucide-react";

/**
 * Public privacy policy — no authentication.
 * Review with a qualified advisor before relying on this as legal compliance.
 */
export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <WebsiteLayout>
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>

        <article className="text-foreground">
          <header className="mb-10 border-b border-border pb-8">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-lg text-muted-foreground">Gymz and Nutrition</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Effective date: 27 March 2026
              <br />
              Last updated: 27 March 2026
            </p>
          </header>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">1. Who we are</h2>
            <p>
              Gymz and Nutrition (“Gymz”, “we”, “us”, “our”) provides a fitness and nutrition mobile application and
              related services that connect members with gyms and support personalised coaching.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Website:{" "}
                <a
                  href="https://gymzandnutrition.com"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://gymzandnutrition.com
                </a>
              </li>
              <li>Email: support@gymzandnutrition.com</li>
              <li>Postal address: IBEX HILL, LUSAKA, ZAMBIA</li>
            </ul>
            <p>
              For the purposes of applicable data protection law, Gymz and Nutrition is the data controller of personal
              information processed through our services as described in this policy, except where we process information
              strictly on behalf of a gym (see section 6).
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">2. Scope</h2>
            <p>This policy applies to personal information we process when you:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>create or use a Gymz account;</li>
              <li>use the app’s fitness, nutrition, gym, and coaching features;</li>
              <li>communicate with us; or</li>
              <li>visit our website.</li>
            </ul>
            <p>If you do not agree with this policy, please do not use our services.</p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">3. Information we collect</h2>
            <p>We collect information in the following categories.</p>

            <h3 className="pt-2 text-lg font-semibold text-foreground">3.1 Account and profile information (you provide)</h3>
            <p>We process information you add or correct in your profile, including:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="text-foreground">Identity and contact:</span> name, email address, phone number;
              </li>
              <li>
                <span className="text-foreground">Profile:</span> profile photo or image you choose to upload;
              </li>
              <li>
                <span className="text-foreground">Demographics used to personalise the service:</span> age and gender.
              </li>
            </ul>
            <p>We use this to run your account, personalise content and coaching, and communicate with you about the service.</p>

            <h3 className="pt-2 text-lg font-semibold text-foreground">3.2 Health, fitness, and activity-related information</h3>
            <p>Depending on how you use the app, we may process:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="text-foreground">Nutrition and meals:</span> information you log or capture, including
                photos of meals taken with the camera where you choose to do so;
              </li>
              <li>
                <span className="text-foreground">Progress imagery:</span> before and progress photos you upload;
              </li>
              <li>
                <span className="text-foreground">Activity:</span> step count or similar activity data where you allow
                access on your device, so we can show activity and related insights in the app.
              </li>
            </ul>
            <p>
              Some of this information may be considered sensitive in certain jurisdictions. We process it only to
              provide the features you use and as described in this policy.
            </p>

            <h3 className="pt-2 text-lg font-semibold text-foreground">3.3 Gym and membership context</h3>
            <p>
              Where you associate with a gym on our platform, we process information needed to provide gym-related
              features (for example membership status, gym affiliation, check-in or access features where available). Gym
              owners and authorised staff may see information about members linked to their gym as described in section
              6.
            </p>

            <h3 className="pt-2 text-lg font-semibold text-foreground">3.4 Communications</h3>
            <p>We may process:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Push notifications and in-app notifications you receive when you enable them on your device;
              </li>
              <li>messages you send to us (for example support email).</li>
            </ul>
            <p>You can control notification permissions in your device settings and, where the app allows, in-app settings.</p>

            <h3 className="pt-2 text-lg font-semibold text-foreground">3.5 Technical, usage, and operational data</h3>
            <p>We collect technical and usage information needed to operate, secure, and improve the app and our systems, including:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>device type, operating system, app version;</li>
              <li>
                aggregated or usage-level information about how the service is used, so we can understand traffic and
                load, maintain reliability, and estimate operational costs.
              </li>
            </ul>
            <p>
              We do not use this section to describe precise GPS location: we do not collect your location as part of our
              core service as described here.
            </p>

            <h3 className="pt-2 text-lg font-semibold text-foreground">3.6 Support and inquiries</h3>
            <p>If you contact us, we keep the content of your message and contact details to respond and handle follow-up.</p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">4. What we do not collect (as part of this policy)</h2>
            <p>Unless we tell you otherwise in a separate notice or feature-specific terms:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>We do not collect location data for the purposes described in this policy.</li>
              <li>
                We do not collect or store payment card numbers or bank credentials through the app as standard practice
                described here. If a payment feature is offered in future through a partner, we will describe it
                separately and rely on certified payment processors.
              </li>
            </ul>
            <p>If anything in the app changes, we will update this policy or provide additional notice where required.</p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">5. Artificial intelligence (OpenAI)</h2>
            <p>Certain features use artificial intelligence provided by OpenAI and our own configuration, including:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>AI chat and coaching-style interactions; and</li>
              <li>
                processing of images you submit (for example meal or other photos you choose to capture or upload) to
                generate analysis, suggestions, or related outputs.
              </li>
            </ul>
            <p>
              When you use these features, your inputs (including text and images you submit) may be transmitted to
              OpenAI or processed through systems that interoperate with OpenAI for the purpose of providing the feature.
            </p>
            <p>
              We configure our services to prioritise user privacy and security. You should not submit photos or text you
              consider highly sensitive unless you accept that processing is needed to deliver the feature. We do not use
              your information to sell personal data. Retention and subprocessors are subject to OpenAI’s terms and our
              agreements; we select settings that align with providing the service.
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">6. Who can see your information</h2>
            <h3 className="pt-2 text-lg font-semibold text-foreground">6.1 Gymz and Nutrition (us)</h3>
            <p>Our team and systems administrators may access personal information as needed to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>provide and improve the service;</li>
              <li>ensure security and prevent abuse;</li>
              <li>comply with law; and</li>
              <li>
                analyse aggregated or operational traffic to run the platform and understand cost and performance.
              </li>
            </ul>
            <h3 className="pt-2 text-lg font-semibold text-foreground">6.2 Gym owners and staff</h3>
            <p>
              Where you are a member of a gym that uses Gymz, gym owners and authorised staff may access member-related
              information in line with how gyms have traditionally managed their members (for example to operate membership,
              coaching, and the gym relationship). The scope depends on your relationship with that gym and the features
              enabled.
            </p>
            <h3 className="pt-2 text-lg font-semibold text-foreground">6.3 Service providers (processors)</h3>
            <p>We use trusted providers who process data on our instructions, including:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Supabase (authentication, database, and related backend infrastructure);</li>
              <li>OpenAI (AI features as described above);</li>
              <li>infrastructure, email, and other vendors needed to host and operate the service.</li>
            </ul>
            <p>We require these providers to protect personal information appropriately.</p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">7. Primary market and international transfers</h2>
            <p>Our primary market is Zambia. We intend to expand to additional countries as we grow.</p>
            <p>
              Your information may be processed in Zambia and in other countries where our providers host data (for example
              cloud regions used by Supabase or OpenAI). Where the law requires, we implement appropriate safeguards for
              international transfers.
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">8. Legal bases and fairness (Zambia and general principles)</h2>
            <p>We process personal information where:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>it is necessary to perform our contract with you (providing the app and account);</li>
              <li>
                we have a legitimate interest that is not overridden by your rights (for example security, service
                improvement, and operational analytics in aggregate form);
              </li>
              <li>we comply with law; or</li>
              <li>you have consented where consent is required (for example certain device permissions or optional features).</li>
            </ul>
            <p>
              We process information fairly, for specified purposes, and keep it no longer than necessary for those
              purposes, subject to legal and security needs.
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">9. Retention</h2>
            <p>
              We retain personal information for as long as your account is active, as needed to provide the service, and as
              required by law. When you delete your data or account through the app (see section 10), we delete or anonymise
              information in line with the app’s functionality and our technical processes, except where we must retain
              limited information for legal, security, or dispute resolution reasons.
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">10. Your rights and choices</h2>
            <p>Depending on applicable law, you may have rights to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>access your personal information;</li>
              <li>correct inaccurate information (you can also update much of this in your profile);</li>
              <li>delete your personal information — you can delete your data directly in the app as we provide;</li>
              <li>object to or restrict certain processing;</li>
              <li>withdraw consent where processing is consent-based (for example device permissions).</li>
            </ul>
            <p>
              To exercise rights or ask questions, email support@gymzandnutrition.com. We may need to verify your identity
              before acting on certain requests.
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">11. Children</h2>
            <p>
              The service is not intended for children under 13. We do not knowingly collect personal information from
              children under 13. If you believe we have collected information from a child under 13, contact us and we will
              take appropriate steps to delete it.
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">12. Security</h2>
            <p>
              We implement technical and organisational measures designed to protect personal information. No system is
              completely secure; we encourage you to use a strong password and protect your device.
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">13. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will post the new version on gymzandnutrition.com (or the
              app) and update the “Last updated” date. If changes are material, we will provide additional notice where
              appropriate (for example in-app or by email).
            </p>
          </section>

          <section className="mb-10 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">14. Contact</h2>
            <p className="text-foreground font-medium">Gymz and Nutrition</p>
            <p>IBEX HILL, LUSAKA, ZAMBIA</p>
            <p>
              Email:{" "}
              <a href="mailto:support@gymzandnutrition.com" className="text-primary underline-offset-2 hover:underline">
                support@gymzandnutrition.com
              </a>
            </p>
            <p>
              Website:{" "}
              <a
                href="https://gymzandnutrition.com"
                className="text-primary underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://gymzandnutrition.com
              </a>
            </p>
          </section>
        </article>
      </div>
    </WebsiteLayout>
  );
}
