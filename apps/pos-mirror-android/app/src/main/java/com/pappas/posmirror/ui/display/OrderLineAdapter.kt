package com.pappas.posmirror.ui.display

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pappas.posmirror.data.model.MirrorOrderLine
import com.pappas.posmirror.databinding.ItemOrderLineBinding
import java.util.Locale

class OrderLineAdapter(
    private val onLineClick: (MirrorOrderLine) -> Unit
) : ListAdapter<MirrorOrderLine, OrderLineAdapter.ViewHolder>(DIFF_CALLBACK) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemOrderLineBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(private val binding: ItemOrderLineBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: MirrorOrderLine) {
            binding.tvQuantity.text = "${item.quantity}×"
            binding.tvItemName.text = item.name
            binding.tvUnitPrice.text = String.format(Locale.US, "$%.2f", item.unitPrice)
            binding.tvLineTotal.text = String.format(Locale.US, "$%.2f", item.lineTotal)

            val hasCustomizations = !item.customizations.isNullOrEmpty()
            binding.tvCustomizedBadge.visibility = if (hasCustomizations) View.VISIBLE else View.GONE

            binding.root.setOnClickListener {
                if (hasCustomizations) {
                    onLineClick(item)
                }
            }
        }
    }

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<MirrorOrderLine>() {
            override fun areItemsTheSame(oldItem: MirrorOrderLine, newItem: MirrorOrderLine): Boolean {
                return oldItem.id == newItem.id
            }

            override fun areContentsTheSame(oldItem: MirrorOrderLine, newItem: MirrorOrderLine): Boolean {
                return oldItem == newItem
            }
        }
    }
}
