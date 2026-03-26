import Link from "next/link";

interface OrderTypeDisplayProps {
  orderType: "pickup" | "delivery" | null;
  deliveryAddress: any;
  deliveryQuote: any;
}

export function OrderTypeDisplay({
  orderType,
  deliveryAddress,
  deliveryQuote,
}: OrderTypeDisplayProps) {
  if (!orderType) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            {orderType === "delivery" ? "Online Delivery" : "Pickup Order"}
          </h3>
          {orderType === "delivery" && deliveryAddress && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {deliveryAddress.address_line1}, {deliveryAddress.city},{" "}
              {deliveryAddress.state} {deliveryAddress.postcode}
            </p>
          )}
          {orderType === "delivery" && deliveryQuote && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Delivery Fee: ${deliveryQuote.fee.toFixed(2)} • Est.{" "}
              {deliveryQuote.estimated_duration_minutes} min
            </p>
          )}
        </div>
        <Link
          href="/order/summary"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Change
        </Link>
      </div>
    </div>
  );
}
