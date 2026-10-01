package com.pappas.posmirror.ui.display

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pappas.posmirror.R
import com.pappas.posmirror.data.model.CustomerQueueEntry
import com.pappas.posmirror.databinding.ItemQueueOrderBinding

class QueueOrderAdapter(
    private val onOrderClick: (CustomerQueueEntry) -> Unit
) : ListAdapter<CustomerQueueEntry, QueueOrderAdapter.ViewHolder>(DIFF_CALLBACK) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemQueueOrderBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(private val binding: ItemQueueOrderBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: CustomerQueueEntry) {
            val title = if (!item.customerName.isNullOrEmpty()) {
                "#${item.orderNumber} - ${item.customerName}"
            } else {
                "#${item.orderNumber}"
            }
            binding.tvOrderNumber.text = title

            val isReady = item.status == "Ready"
            if (isReady) {
                binding.tvStatusBadge.text = "COLLECT NOW"
                binding.tvStatusBadge.setTextColor(ContextCompat.getColor(binding.root.context, R.color.brand_ready))
                binding.layoutCard.setBackgroundColor(Color.parseColor("#F0FDF4"))
            } else {
                binding.tvStatusBadge.text = "PREPARING"
                binding.tvStatusBadge.setTextColor(ContextCompat.getColor(binding.root.context, R.color.brand_preparing))
                binding.layoutCard.setBackgroundResource(R.drawable.bg_order_item)
            }

            binding.root.setOnClickListener {
                onOrderClick(item)
            }
        }
    }

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<CustomerQueueEntry>() {
            override fun areItemsTheSame(oldItem: CustomerQueueEntry, newItem: CustomerQueueEntry): Boolean {
                return oldItem.id == newItem.id
            }

            override fun areContentsTheSame(oldItem: CustomerQueueEntry, newItem: CustomerQueueEntry): Boolean {
                return oldItem == newItem
            }
        }
    }
}
