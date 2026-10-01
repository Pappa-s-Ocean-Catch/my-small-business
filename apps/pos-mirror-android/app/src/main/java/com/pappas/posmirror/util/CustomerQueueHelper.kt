package com.pappas.posmirror.util

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.pappas.posmirror.data.model.CustomerQueueEntry
import com.pappas.posmirror.data.model.QueueOrderItem
import com.pappas.posmirror.data.model.QueueOrderItemAddon
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object CustomerQueueHelper {
    private const val PRE_ORDER_LEAD_MINUTES = 30
    private const val PRE_ORDER_LEAD_MS = PRE_ORDER_LEAD_MINUTES * 60 * 1000L

    private val statusMap = mapOf(
        "pending" to "Pending",
        "confirmed" to "Confirmed",
        "preparing" to "Preparing",
        "ready" to "Ready"
    )

    private fun parseIso(iso: String?): Long? {
        if (iso.isNullOrEmpty()) return null
        return try {
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            // Strip fractional seconds if any
            val clean = if (iso.contains(".")) {
                iso.substring(0, iso.indexOf('.'))
            } else if (iso.endsWith("Z")) {
                iso.substring(0, iso.length - 1)
            } else {
                iso
            }
            format.parse(clean)?.time
        } catch (e: Exception) {
            null
        }
    }

    private fun getCustomerOrderNumber(orderNumber: String): String {
        val trimmed = orderNumber.trim()
        val parts = trimmed.split("-")
        return parts.lastOrNull()?.trim() ?: trimmed
    }

    fun parseAndBuildQueue(jsonArray: JsonArray, nowMs: Long = System.currentTimeMillis()): List<CustomerQueueEntry> {
        val list = mutableListOf<CustomerQueueEntry>()

        for (elem in jsonArray) {
            if (!elem.isJsonObject) continue
            val obj = elem.asJsonObject

            val orderStatus = obj.get("order_status")?.takeIf { !it.isJsonNull }?.asString ?: ""
            val paymentStatus = obj.get("payment_status")?.takeIf { !it.isJsonNull }?.asString ?: ""
            val status = statusMap[orderStatus]

            if (status == null || paymentStatus == "refunded") {
                continue
            }

            val scheduledPickupAt = obj.get("scheduled_pickup_at")?.takeIf { !it.isJsonNull }?.asString
            val scheduledPickupMs = parseIso(scheduledPickupAt)
            if (scheduledPickupMs != null && (scheduledPickupMs - nowMs) > PRE_ORDER_LEAD_MS) {
                continue
            }

            val id = obj.get("id")?.asString ?: ""
            val orderNumberRaw = obj.get("order_number")?.asString ?: ""
            val createdAt = obj.get("created_at")?.asString ?: ""
            val customerName = obj.get("customer_name")?.takeIf { !it.isJsonNull }?.asString
            val total = obj.get("total")?.takeIf { !it.isJsonNull }?.asDouble ?: 0.0

            val items = mutableListOf<QueueOrderItem>()
            val itemsJson = obj.get("order_items")?.takeIf { it.isJsonArray }?.asJsonArray
            if (itemsJson != null) {
                for (itemElem in itemsJson) {
                    if (!itemElem.isJsonObject) continue
                    val itemObj = itemElem.asJsonObject
                    val itemId = itemObj.get("id")?.asString ?: ""
                    val prodName = itemObj.get("product_name")?.asString ?: ""
                    val qty = itemObj.get("quantity")?.asInt ?: 0
                    val subtotal = itemObj.get("subtotal")?.asDouble ?: 0.0

                    val addons = mutableListOf<QueueOrderItemAddon>()
                    val addonsJson = itemObj.get("order_item_addons")?.takeIf { it.isJsonArray }?.asJsonArray
                    if (addonsJson != null) {
                        for (addonElem in addonsJson) {
                            if (!addonElem.isJsonObject) continue
                            val addonObj = addonElem.asJsonObject
                            addons.add(
                                QueueOrderItemAddon(
                                    id = addonObj.get("id")?.asString ?: "",
                                    addonItemName = addonObj.get("addon_item_name")?.asString ?: "",
                                    addonItemPrice = addonObj.get("addon_item_price")?.asDouble ?: 0.0
                                )
                            )
                        }
                    }

                    items.add(
                        QueueOrderItem(
                            id = itemId,
                            productName = prodName,
                            quantity = qty,
                            subtotal = subtotal,
                            orderItemAddons = addons
                        )
                    )
                }
            }

            val sortAt = if (scheduledPickupMs == null) createdAt else scheduledPickupAt!!

            list.add(
                CustomerQueueEntry(
                    id = id,
                    orderNumber = getCustomerOrderNumber(orderNumberRaw),
                    status = status,
                    customerName = customerName,
                    total = total,
                    sortAt = sortAt,
                    items = items
                )
            )
        }

        list.sortBy { parseIso(it.sortAt) ?: 0L }
        return list
    }
}
