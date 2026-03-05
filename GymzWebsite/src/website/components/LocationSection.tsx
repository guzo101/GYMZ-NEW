import { MapPin, Mail, Phone, Facebook, Instagram, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./SectionHeader";

export function LocationSection() {
    const address = "Ibex Hill, Lusaka, Zambia";
    const email = "support.gymz@gmail.com";
    const phone = "09260417050";

    // Using standard Google Maps Embed API with a very specific query to ensure a Pin drops.
    // 'cleaner map' -> Removing CSS filters like grayscale/contrast.
    const googleMapsEmbedUrl = "https://maps.google.com/maps?q=Ibex%20Hill%2C%20Lusaka%2C%20Zambia&t=m&z=15&ie=UTF8&iwloc=&output=embed";

    const socialLinks = [
        { icon: <Facebook className="w-5 h-5" />, label: "Facebook", href: "https://facebook.com" },
        { icon: <MessageCircle className="w-5 h-5" />, label: "Messenger", href: "https://m.me" },
        { icon: <Instagram className="w-5 h-5" />, label: "Instagram", href: "https://instagram.com" },
    ];

    return (
        <section id="location" className="py-12 md:py-24 relative overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-[hsl(var(--primary))]/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-0 -z-10 w-[600px] h-[600px] bg-[hsl(var(--primary))]/5 rounded-full blur-[120px]" />

            <div className="max-w-7xl mx-auto px-6">
                <SectionHeader
                    eyebrow="Find Us"
                    title="Visit Our Gym"
                    description="We're located in the heart of Ibex Hill. Come visit us for a workout or talk to our expert trainers."
                    align="center"
                />

                <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
                    {/* Map Container - Made slightly taller for better 'communication' */}
                    <div className="relative group h-[400px] md:h-[500px] w-full rounded-3xl overflow-hidden shadow-2xl border border-border/50">
                        <iframe
                            src={googleMapsEmbedUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen={true}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Stamina Fitness Gym Location"
                            className="grayscale-0 contrast-100 brightness-100" // REMOVED FILTERS for cleaner look
                        ></iframe>
                        {/* Subtle overlay border for finish */}
                        <div className="absolute inset-0 pointer-events-none border-4 border-white/10 rounded-3xl" />
                    </div>

                    {/* Contact Info Card - Improved spacing and centering */}
                    <div className="flex flex-col justify-center h-full gap-8 p-10 md:p-14 rounded-3xl bg-card/60 backdrop-blur-2xl border border-white/10 shadow-2xl">
                        <div className="space-y-10">
                            <div className="flex items-center gap-6 group/item">
                                <div className="p-4 rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] group-hover/item:bg-[hsl(var(--primary))] group-hover/item:text-white transition-colors duration-300">
                                    <MapPin className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">Address</h3>
                                    <p className="text-muted-foreground text-lg leading-relaxed">
                                        {address}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 group/item">
                                <div className="p-4 rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] group-hover/item:bg-[hsl(var(--primary))] group-hover/item:text-white transition-colors duration-300">
                                    <Mail className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">Email</h3>
                                    <p className="text-muted-foreground text-lg">{email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 group/item">
                                <div className="p-4 rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] group-hover/item:bg-[hsl(var(--primary))] group-hover/item:text-white transition-colors duration-300">
                                    <Phone className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">Contact Number</h3>
                                    <p className="text-muted-foreground text-lg">{phone}</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-border/50">
                            <h3 className="text-sm uppercase tracking-widest font-bold text-muted-foreground mb-8">Our Socials</h3>
                            <div className="flex gap-4">
                                {socialLinks.map((social) => (
                                    <Button
                                        key={social.label}
                                        variant="outline"
                                        size="icon"
                                        className="w-14 h-14 rounded-2xl hover:bg-[hsl(var(--primary))] hover:text-white hover:border-[hsl(var(--primary))] transition-all duration-300"
                                        asChild
                                    >
                                        <a href={social.href} target="_blank" rel="noopener noreferrer">
                                            {social.icon}
                                        </a>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button className="w-full h-16 rounded-2xl bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] text-white font-bold text-xl shadow-xl hover:shadow-[hsl(var(--primary))]/30 transition-all transform hover:-translate-y-1">
                                Get Directions
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
