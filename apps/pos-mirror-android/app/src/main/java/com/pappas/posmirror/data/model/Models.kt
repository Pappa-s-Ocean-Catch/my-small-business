package com.pappas.posmirror.data.model

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Customization(
    @SerialName("label") @SerializedName("label") val label: String
)

@Serializable
data class MirrorOrderLine(
    @SerialName("id") @SerializedName("id") val id: String,
    @SerialName("name") @SerializedName("name") val name: String,
    @SerialName("quantity") @SerializedName("quantity") val quantity: Int,
    @SerialName("unitPrice") @SerializedName("unitPrice") val unitPrice: Double,
    @SerialName("lineTotal") @SerializedName("lineTotal") val lineTotal: Double,
    @SerialName("customizations") @SerializedName("customizations") val customizations: List<Customization>? = null
)

@Serializable
data class MirrorOrderSnapshot(
    @SerialName("version") @SerializedName("version") val version: Int = 1,
    @SerialName("updatedAt") @SerializedName("updatedAt") val updatedAt: String = "",
    @SerialName("itemCount") @SerializedName("itemCount") val itemCount: Int = 0,
    @SerialName("items") @SerializedName("items") val items: List<MirrorOrderLine> = emptyList(),
    @SerialName("subtotal") @SerializedName("subtotal") val subtotal: Double = 0.0,
    @SerialName("discount") @SerializedName("discount") val discount: Double = 0.0,
    @SerialName("total") @SerializedName("total") val total: Double = 0.0
) {
    val isEmpty: Boolean
        get() = items.isEmpty() && total == 0.0
}

@Serializable
data class QueueOrderItemAddon(
    @SerialName("id") @SerializedName("id") val id: String = "",
    @SerialName("addon_item_name") @SerializedName("addon_item_name") val addonItemName: String = "",
    @SerialName("addon_item_price") @SerializedName("addon_item_price") val addonItemPrice: Double = 0.0
)

@Serializable
data class QueueOrderItem(
    @SerialName("id") @SerializedName("id") val id: String = "",
    @SerialName("product_name") @SerializedName("product_name") val productName: String = "",
    @SerialName("quantity") @SerializedName("quantity") val quantity: Int = 0,
    @SerialName("subtotal") @SerializedName("subtotal") val subtotal: Double = 0.0,
    @SerialName("order_item_addons") @SerializedName("order_item_addons") val orderItemAddons: List<QueueOrderItemAddon>? = null
)

@Serializable
data class CustomerQueueEntry(
    @SerialName("id") @SerializedName("id") val id: String,
    @SerialName("orderNumber") @SerializedName("orderNumber") val orderNumber: String,
    @SerialName("status") @SerializedName("status") val status: String, // "Ready", "Preparing", "Confirmed", "Pending"
    @SerialName("customerName") @SerializedName("customerName") val customerName: String? = null,
    @SerialName("total") @SerializedName("total") val total: Double = 0.0,
    @SerialName("sortAt") @SerializedName("sortAt") val sortAt: String = "",
    @SerialName("items") @SerializedName("items") val items: List<QueueOrderItem> = emptyList()
)

@Serializable
data class RegisterOption(
    val id: String,
    val name: String
)

@Serializable
data class MirrorSettings(
    val registerId: String = "",
    val idleMode: String = "image", // "image" or "queue"
    val idleImageUri: String? = null,
    val showClock: Boolean = true
)
