"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TypewriterText } from "@/components/TypewriterText";
import { FaUtensils, FaArrowRight, FaPhone } from "react-icons/fa";
import { ReviewSummaryWidget } from "@/components/ReviewSummaryWidget";
import React from "react";

import type { Promotion } from "@/lib/promotions";

interface HeroProps {
    homePromotions: Promotion[];
    enablePickupOrder: boolean;
    reviewSectionId: string;
}

export function Hero({ homePromotions, enablePickupOrder, reviewSectionId }: HeroProps) {
    return (
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
                {/* Review summary widget */}
                <div className="flex justify-center mb-6">
                    <ReviewSummaryWidget scrollToId={reviewSectionId} />
                </div>
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

                    {/* Only show Pickup Order button if enablePickupOrder is true (not undefined) */}
                    {enablePickupOrder === true && (
                        <Link
                            href="/order"
                            className="inline-flex items-center justify-center gap-2 px-8 py-3 md:py-4 bg-emerald-500 text-white rounded-lg font-bold text-lg shadow-lg hover:bg-emerald-600 hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-300"
                        >
                            Pickup Order
                            <Icon icon={FaArrowRight} className="w-5 h-5" />
                        </Link>
                    )}
                    <Link
                        href="/order/delivery"
                        target="_self"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 md:py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold text-lg hover:bg-white/20 transition-colors border-2 border-white/30"
                    >
                        Delivery Order
                        <Icon icon={FaArrowRight} className="w-5 h-5" />
                    </Link>

                    <Link
                        href="/menu"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 md:py-4 bg-rose-600 text-white rounded-lg font-semibold text-lg hover:bg-rose-700 transition-colors shadow-lg hover:shadow-xl"
                    >
                        <Icon icon={FaUtensils} className="w-5 h-5" />
                        View Our Menu
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
    );
}
