package com.pappas.posmirror.ui.display

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.pappas.posmirror.R
import com.pappas.posmirror.data.model.QueueOrderItem
import com.pappas.posmirror.databinding.ItemModalDetailLineBinding
import java.util.Locale

class OrderDetailItemAdapter(
    private var items: List<QueueOrderItem> = emptyList()
) : RecyclerView.Adapter<OrderDetailItemAdapter.ViewHolder>() {

    fun submitList(newItems: List<QueueOrderItem>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemModalDetailLineBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemModalDetailLineBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: QueueOrderItem) {
            binding.tvModalItemQty.text = "${item.quantity}×"
            binding.tvModalItemName.text = item.productName
            binding.tvModalItemSubtotal.text = String.format(Locale.US, "$%.2f", item.subtotal)

            binding.layoutAddons.removeAllViews()

            val addons = item.orderItemAddons
            if (!addons.isNullOrEmpty()) {
                binding.layoutAddons.visibility = View.VISIBLE
                val context = binding.root.context
                val mutedColor = ContextCompat.getColor(context, R.color.brand_muted_text)

                val grouped = addons.groupBy { it.addonItemName.trim() }

                for ((name, groupList) in grouped) {
                    val count = groupList.size
                    val totalPrice = groupList.sumOf { it.addonItemPrice }
                    val label = if (count > 1) "${count}x $name" else name
                    val priceText = if (totalPrice > 0.0) {
                        String.format(Locale.US, " (+$%.2f)", totalPrice)
                    } else ""

                    val tvAddon = TextView(context).apply {
                        text = "• $label$priceText"
                        textSize = 14f
                        setTextColor(mutedColor)
                        setPadding(0, 2, 0, 2)
                    }
                    binding.layoutAddons.addView(tvAddon)
                }
            } else {
                binding.layoutAddons.visibility = View.GONE
            }
        }
    }
}
