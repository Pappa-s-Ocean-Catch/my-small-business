import React from "react";
import Image from "next/image";

interface Partner {
    name: string;
    logo: string;
    url: string;
}

const partners: Partner[] = [
    {
        name: "Uber Eats",
        logo: "/partners/Uber-Eats-logo.png",
        url: "https://www.ubereats.com/au/store/pappas-ocean-catch/M0z1JnhIVOWbnCQt-0ZQPA",
    },
    {
        name: "DoorDash",
        logo: "/partners/DoorDash-logo.png",
        url: "https://www.doordash.com/store/pappa's-ocean-catch-melton-25864570/97468946/",
    },
    {
        name: "Foodhub",
        logo: "/partners/Foodhub-logo.png",
        url: "https://pappasoceancatch-ea.com.au/",
    },
];

export const PartnerBlock: React.FC = () => (
    <section className="py-20 px-4 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">Partners</h2>
            <p className="text-xl text-gray-600 mb-2">Order from our partners online</p>
            <p className="text-sm text-gray-500 mb-10">Note: Prices on these platforms may be higher due to partner commission fees.</p>
            <div className="flex flex-wrap justify-center gap-8">
                {partners.map((partner) => (
                    <a
                        key={partner.name}
                        href={partner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center group w-40"
                    >
                        <div className="w-28 h-28 bg-white rounded-xl shadow flex items-center justify-center mb-3 border border-gray-200 group-hover:shadow-lg transition-shadow">
                            <Image
                                src={partner.logo}
                                alt={partner.name + ' logo'}
                                width={96}
                                height={96}
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                        <span className="text-lg font-semibold text-gray-800 group-hover:text-rose-600 transition-colors">
                            {partner.name}
                        </span>
                    </a>
                ))}
            </div>
        </div>
    </section>
);
