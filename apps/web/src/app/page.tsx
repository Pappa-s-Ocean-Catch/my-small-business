"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import Link from "next/link";
import { FaUtensils, FaArrowRight, FaPhone, FaClock, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import { Icon } from "@/components/Icon";
import Image from "next/image";
import { TypewriterText } from "@/components/TypewriterText";
import { getHomePromotions } from "@/app/actions/promotions";
import type { Promotion } from "@/lib/promotions";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

interface FeaturedProduct {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
  image_url: string | null;
  slug?: string | null;
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [contactForm, setContactForm] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactMessage, setContactMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { onlineOrderEnabled, isLoading: flagLoading } = useFeatureFlag();
  const [homePromotions, setHomePromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = getSupabaseClient();
        // Fetch featured products marked with is_featured flag
        const { data, error } = await supabase
          .from("sale_products")
          .select("id, name, description, sale_price, image_url, slug")
          .eq("is_active", true)
          .eq("is_featured", true)
          .not("image_url", "is", null)
          .limit(6)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching featured products:", error);
        } else {
          setFeaturedProducts(data || []);
        }

        const promoRes = await getHomePromotions();
        if (promoRes.data) setHomePromotions(promoRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const enablePickupOrder = flagLoading ? undefined : (onlineOrderEnabled ?? false);

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "Pappa's Ocean Catch",
    "image": `${process.env.NEXT_PUBLIC_SITE_URL || "https://pappasoceancatch.com.au"}/og-image.jpg`,
    "description": "Fresh fish and chips takeaway in Melton. Traditional batter, hand-cut chips, and the freshest seafood daily.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Melton",
      "addressRegion": "VIC",
      "addressCountry": "AU",
    },
    "telephone": "+61397438150",
    "priceRange": "$$",
    "servesCuisine": "Fish and Chips",
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday"],
        "opens": "11:00",
        "closes": "20:30",
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Friday",
        "opens": "11:00",
        "closes": "21:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Saturday", "Sunday"],
        "opens": "11:00",
        "closes": "20:30",
      },
    ],
    "url": process.env.NEXT_PUBLIC_SITE_URL || "https://pappasoceancatch.com.au",
    "menu": `${process.env.NEXT_PUBLIC_SITE_URL || "https://pappasoceancatch.com.au"}/menu`,
    "acceptsReservations": false,
    "hasMenu": true,
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactMessage(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactForm),
      });

      const data = await response.json();

      if (data.success) {
        setContactMessage({ type: "success", text: data.message });
        setContactForm({ name: "", email: "", phone: "", message: "" });
      } else {
        setContactMessage({ type: "error", text: data.error || "Failed to send message" });
      }
    } catch (error) {
      setContactMessage({
        type: "error",
        text: "An error occurred. Please try again later.",
      });
    } finally {
      setContactLoading(false);
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.id = 'restaurant-structured-data';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);
    return () => {
      const existingScript = document.getElementById('restaurant-structured-data');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [structuredData]);

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Hero Section with Image Background */}
        <section className="relative h-screen flex items-center justify-center overflow-hidden">
          {/* Image Background */}
          <div className="absolute inset-0 z-0">
            {/* Desktop Image */}
            <Image
              src="/hero.png"
              alt="Pappa's Ocean Catch"
              fill
              className="object-cover hidden md:block"
              priority
              unoptimized
            />
            {/* Mobile Image */}
            <Image
              src="/hero-mobile.png"
              alt="Pappa's Ocean Catch"
              fill
              className="object-cover md:hidden"
              priority
              unoptimized
            />
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
            {homePromotions.length > 0 && (
              <div className="inline-flex items-center justify-center mb-4 px-4 py-2 rounded-full bg-green-600/90 text-white text-sm font-semibold backdrop-blur">
                {homePromotions[0].home_title || homePromotions[0].title}
              </div>
            )}
            <h1 className="hidden text-4xl md:text-7xl font-bold text-white mb-4 md:mb-6 drop-shadow-lg min-h-[1.2em]">
              <TypewriterText
                text="Welcome to Pappa's Ocean Catch"
                speed={80}
                className="inline-block"
              />order
            </h1>
            <p className="text-lg md:text-2xl text-white/90 mb-4 md:mb-6 drop-shadow-md">
              Fresh Fish. Crispy Chips. Done Right.
            </p>
            <div className="w-full max-w-2xl mx-auto mb-5 md:mb-8">
              <p className="text-sm md:text-base text-white/90 mb-3 font-semibold">Call now to order</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="tel:+61397438150"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-white font-semibold backdrop-blur-sm hover:bg-white/20 transition-colors"
                >
                  <Icon icon={FaPhone} className="w-4 h-4" />
                  (03) 9743 8150
                </a>
                <a
                  href="tel:+61466994085"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-white font-semibold backdrop-blur-sm hover:bg-white/20 transition-colors"
                >
                  <Icon icon={FaPhone} className="w-4 h-4" />
                  0466 994 085
                </a>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Link
                href="/menu"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 md:py-4 bg-rose-600 text-white rounded-lg font-semibold text-lg hover:bg-rose-700 transition-colors shadow-lg hover:shadow-xl"
              >
                <Icon icon={FaUtensils} className="w-5 h-5" />
                View Our Menu
              </Link>
              {/* Only show Pickup Order button if enablePickupOrder is true (not undefined) */}
              {enablePickupOrder === true && (
                <Link
                  href="/order"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 md:py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold text-lg hover:bg-white/20 transition-colors border-2 border-white/30"
                >
                  Pickup Order
                  <Icon icon={FaArrowRight} className="w-5 h-5" />
                </Link>
              )}
              <Link
                href="https://pappasoceancatch-ea.com.au/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 md:py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold text-lg hover:bg-white/20 transition-colors border-2 border-white/30"
              >
                Delivery Order
                <Icon icon={FaArrowRight} className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-white/50 rounded-full mt-2" />
            </div>
          </div>
        </section>

        {/* Featured Products Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-white to-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Popular Choices
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Discover our chef&apos;s special selections, crafted with the finest ingredients
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse"
                  >
                    <div className="h-64 bg-gray-200" />
                    <div className="p-6">
                      <div className="h-6 bg-gray-200 rounded mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {featuredProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/order/product/${product.slug?.trim() ? product.slug.trim() : product.id}`}
                    aria-label={`View details for ${product.name}`}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow group block focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <div className="relative h-64 overflow-hidden">
                      {product.image_url && !imageErrors.has(product.id) ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                          unoptimized
                          onError={() => {
                            setImageErrors((prev) => new Set(prev).add(product.id));
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center">
                          <Icon icon={FaUtensils} className="w-16 h-16 text-rose-300" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-rose-600">
                          ${product.sale_price.toFixed(2)}
                        </span>
                        <span className="text-rose-600 group-hover:text-rose-700 font-semibold flex items-center gap-1">
                          View Details
                          <Icon icon={FaArrowRight} className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">
                  Check back soon for our Popular Choices!
                </p>
              </div>
            )}

            <div className="text-center mt-12">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 px-8 py-4 bg-rose-600 text-white rounded-lg font-semibold text-lg hover:bg-rose-700 transition-colors shadow-lg"
              >
                View Full Menu
                <Icon icon={FaArrowRight} className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              About Us
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed mb-6">
              At Pappa&apos;s Ocean Catch, we&apos;re passionate about serving the finest fish and chips
              made with the freshest catch from the ocean. Our traditional batter recipe, perfected over
              years, creates that perfect golden crunch that pairs beautifully with our hand-cut chips.
            </p>
            <p className="text-xl text-gray-600 leading-relaxed">
              We source only the best quality fish daily, ensuring every meal is fresh, crispy, and
              full of flavor. Whether you&apos;re craving classic fish and chips, or exploring our
              seafood selection, we bring the authentic taste of the ocean to your table.
            </p>
          </div>
        </section>

        {/* Opening Hours Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-4">
                <Icon icon={FaClock} className="w-8 h-8 text-rose-600" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Opening Hours
              </h2>
              <p className="text-xl text-gray-600">
                We&apos;re here to serve you fresh seafood every day
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <span className="text-lg font-semibold text-gray-700">Monday - Thursday</span>
                  <span className="text-xl font-bold text-rose-600">11:00 AM - 8:30 PM</span>
                </div>
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <span className="text-lg font-semibold text-gray-700">Friday</span>
                  <span className="text-xl font-bold text-rose-600">11:00 AM - 9:00 PM</span>
                </div>
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <span className="text-lg font-semibold text-gray-700">Saturday</span>
                  <span className="text-xl font-bold text-rose-600">11:00 AM - 8:30 PM</span>
                </div>
                <div className="flex items-center justify-between py-4">
                  <span className="text-lg font-semibold text-gray-700">Sunday</span>
                  <span className="text-xl font-bold text-rose-600">11:00 AM - 8:30 PM</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-4">
                <Icon icon={FaEnvelope} className="w-8 h-8 text-rose-600" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Get in Touch
              </h2>
              <p className="text-xl text-gray-600">
                Have a question or feedback? We&apos;d love to hear from you!
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      value={contactForm.name}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, name: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      value={contactForm.email}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, email: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition"
                    placeholder="Your phone number"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={6}
                    value={contactForm.message}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, message: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition resize-none"
                    placeholder="Tell us how we can help..."
                  />
                </div>
                {contactMessage && (
                  <div
                    className={`p-4 rounded-lg ${contactMessage.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                  >
                    {contactMessage.text}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={contactLoading}
                  className="w-full md:w-auto px-8 py-4 bg-rose-600 text-white rounded-lg font-semibold text-lg hover:bg-rose-700 transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contactLoading ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Map Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-white to-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-4">
                <Icon icon={FaMapMarkerAlt} className="w-8 h-8 text-rose-600" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Find Us
              </h2>
              <p className="text-xl text-gray-600">
                Visit us at our location in Melton
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Address Card */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Location</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Icon icon={FaMapMarkerAlt} className="w-5 h-5 text-rose-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-semibold text-gray-900">Pappa&apos;s Ocean Catch</p>
                      <p className="text-gray-600">
                        2/87 Unitt Street<br />
                        Melton VIC 3337<br />
                        Australia
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Icon icon={FaPhone} className="w-5 h-5 text-rose-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-gray-600">
                        <a href="tel:+61397438150" className="hover:text-rose-600 transition-colors">
                          (03) 9743 8150
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=-37.682364,144.580813"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors shadow-lg hover:shadow-xl"
                  >
                    <Icon icon={FaArrowRight} className="w-4 h-4" />
                    Get Directions
                  </a>
                </div>
              </div>

              {/* Google Maps Embed */}
              <div className="rounded-lg shadow-lg overflow-hidden">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3144.1234567890123!2d144.580813!3d-37.682364!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6ad6ed3df5090b31%3A0xc1552fd45e7cd665!2sPappa%27s%20Ocean%20Catch!5e0!3m2!1sen!2sau!4v1704960000000!5m2!1sen!2sau"
                  width="100%"
                  height="100%"
                  style={{ minHeight: "400px", border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Pappa's Ocean Catch Location - 2/87 Unitt Street, Melton VIC 3337"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
