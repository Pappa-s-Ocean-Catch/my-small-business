import Link from "next/link";
import { getPublicSiteUrl } from "@/lib/public-site-url";

const shopPhoneHref = "tel:+61397438150";
const shopPhoneLabel = "(03) 9743 8150";
const googleReviewUrl =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL?.trim() ||
  "https://www.google.com/search?q=Pappa%27s+Ocean+Catch+Melton+reviews";

function QuickLink({
  href,
  title,
  description,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  accent: string;
}) {
  const isInternal = href.startsWith("/");
  const className = "block rounded-3xl border border-black/10 bg-white p-5 shadow-sm transition-transform duration-150 hover:-translate-y-0.5";

  const content = (
    <>
      <div
        className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        Quick Link
      </div>
      <div className="text-2xl font-black text-neutral-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
    </>
  );

  if (isInternal) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={className}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
    >
      {content}
    </a>
  );
}

export default function QrLandingPage() {
  const siteUrl = getPublicSiteUrl();
  const onlineOrderUrl = `${siteUrl}/order`;
  const onlineDeliveryUrl = `${siteUrl}/order/delivery`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed_0%,#ffffff_42%,#f8fafc_100%)]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="border-b border-black/5 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#ea580c_100%)] px-6 py-8 text-white sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-100">Pappa&apos;s Ocean Catch</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-100 sm:text-base">
              Thanks for visiting us. Use the links below to order again, leave a review, browse the menu, or call the shop directly.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-10 sm:py-10">
            <div className="grid gap-4 md:grid-cols-2">
              <QuickLink
                href={onlineOrderUrl}
                title="Order Online"
                description="Start a new pickup or delivery order from our website."
                accent="#2563eb"
              />
              <QuickLink
                href={googleReviewUrl}
                title="Leave a Google Review"
                description="Share your feedback and help more customers find us."
                accent="#dc2626"
              />
              <QuickLink
                href={onlineDeliveryUrl}
                title="Online Delivery"
                description="Go straight to the online delivery ordering page."
                accent="#0f766e"
              />
              <QuickLink
                href={shopPhoneHref}
                title="Phone Order"
                description={`Call ${shopPhoneLabel} to place an order with the shop team.`}
                accent="#7c3aed"
              />
              <QuickLink
                href={onlineOrderUrl}
                title="Start Order"
                description="Open the customer ordering page for pickup or delivery."
                accent="#ca8a04"
              />
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-orange-100 bg-orange-50 px-5 py-4 text-sm text-orange-950">
              Shop 2/87 Unitt Street, Melton VIC 3337
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
