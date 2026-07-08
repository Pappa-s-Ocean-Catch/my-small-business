import React from "react";
import Image from "next/image";

interface Partner {
    name: string;
    logo: string;
    url: string;
    rating: {
        average: string;
        total: string;
        link: string;
    };
}

const StarRating: React.FC<{ average: number }> = ({ average }) => {
    const percentage = Math.max(0, Math.min(average / 5, 1)) * 100;

    return (
        <span className="relative inline-flex text-sm leading-none" aria-hidden="true">
            <span className="text-gray-300">★★★★★</span>
            <span
                className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-400"
                style={{ width: `${percentage}%` }}
            >
                ★★★★★
            </span>
        </span>
    );
};

const partners: Partner[] = [
    {
        name: "Uber Eats",
        logo: "/partners/Uber-Eats-logo.png",
        url: "https://www.ubereats.com/au/store/pappas-ocean-catch/M0z1JnhIVOWbnCQt-0ZQPA",
        rating: {
            average: "4.6",
            total: "390+",
            link: "https://www.ubereats.com/au/store/pappas-ocean-catch/M0z1JnhIVOWbnCQt-0ZQPA?diningMode=DELIVERY&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMjIwMCUyMENlbnRlbmFyeSUyMEF2ZSUyMiUyQyUyMnJlZmVyZW5jZSUyMiUzQSUyMkNoSUpTMEc0WWhydDFtb1IzLVNWaUw4dHUwTSUyMiUyQyUyMnJlZmVyZW5jZVR5cGUlMjIlM0ElMjJnb29nbGVfcGxhY2VzJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0EtMzcuNjczMzA4OCUyQyUyMmxvbmdpdHVkZSUyMiUzQTE0NC41NzU4NDElN0Q%3D",
        },
    },
    {
        name: "DoorDash",
        logo: "/partners/DoorDash-logo.png",
        url: "https://www.doordash.com/store/pappa's-ocean-catch-melton-25864570/97468946/",
        rating: {
            average: "4.4",
            total: "200+",
            link: "https://www.doordash.com/store/pappa's-ocean-catch-melton-25864570/97468946/",
        },
    },
    {
        name: "Foodhub",
        logo: "/partners/Foodhub-logo.png",
        url: "https://pappasoceancatch-ea.com.au/",
        rating: {
            average: "4.9",
            total: "90+",
            link: "https://pappasoceancatch-ea.com.au/",
        },
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
                    <div key={partner.name} className="flex flex-col items-center w-40 text-center">
                        <a
                            href={partner.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group"
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
                        </a>
                        <span className="text-base font-semibold text-gray-900">{partner.name}</span>
                        <a
                            href={partner.rating.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${partner.name} rating ${partner.rating.average} out of 5 from ${partner.rating.total} ratings`}
                            className="mt-1 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                        >
                            <StarRating average={Number(partner.rating.average)} />
                            <span>{partner.rating.average}</span>
                            <span className="text-gray-400">({partner.rating.total})</span>
                        </a>
                    </div>
                ))}
            </div>
        </div>
    </section>
);
