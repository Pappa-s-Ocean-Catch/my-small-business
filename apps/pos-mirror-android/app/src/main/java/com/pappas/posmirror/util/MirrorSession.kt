package com.pappas.posmirror.util

import com.pappas.posmirror.data.model.MirrorOrderSnapshot
import java.time.Instant

data class MirrorStateUpdate(val registerId: String, val snapshot: MirrorOrderSnapshot?)

/** Pins the displayed cart to one register until that register clears it. */
class MirrorSession(private val now: () -> Long = System::currentTimeMillis) {
    private data class RegisterState(
        val snapshot: MirrorOrderSnapshot?, val revision: Long, val firstSeen: Long, val updatedAt: Long
    )
    private val registers = linkedMapOf<String, RegisterState>()
    var registerId: String? = null
        private set
    var revision = 0L
        private set
    val snapshot: MirrorOrderSnapshot
        get() = registers[registerId]?.snapshot ?: MirrorOrderSnapshot()

    fun apply(id: String, incoming: MirrorOrderSnapshot?) {
        update(id, incoming)
        expire()
    }

    fun refresh(rows: List<MirrorStateUpdate>, startedAtRevision: Long) {
        val present = rows.map { it.registerId }.toSet()
        for ((id, state) in registers.toMap()) {
            if (id !in present && state.revision <= startedAtRevision) update(id, MirrorOrderSnapshot())
        }
        for (row in rows.sortedWith(compareBy<MirrorStateUpdate> {
            it.snapshot?.let(::snapshotTime) ?: Long.MAX_VALUE
        }.thenBy { it.registerId })) {
            if ((registers[row.registerId]?.revision ?: 0L) <= startedAtRevision) update(row.registerId, row.snapshot)
        }
        expire()
    }

    private fun update(id: String, incoming: MirrorOrderSnapshot?) {
        if (id.isBlank() || incoming == null) return
        val previous = registers[id]
        val empty = incoming == MirrorOrderSnapshot()
        if (!empty && !isValidMirrorSnapshot(incoming)) return
        val updatedAt = if (empty) previous?.updatedAt ?: 0L else snapshotTime(incoming) ?: return
        if (!empty && previous != null && updatedAt <= previous.updatedAt) {
            registers[id] = previous.copy(revision = ++revision)
            return
        }
        revision++
        registers[id] = RegisterState(
            if (empty) null else incoming, revision,
            if (previous?.snapshot != null) previous.firstSeen else revision, updatedAt
        )
    }

    /** Expire locally even when the network fetch fails; keep timestamp watermarks. */
    fun expire() {
        val currentTime = now()
        for ((id, state) in registers.toMap()) {
            if (state.snapshot != null && currentTime - state.updatedAt > 5 * 60 * 1000L) {
                registers[id] = state.copy(snapshot = null, revision = ++revision)
            }
        }
        selectOwner()
    }

    private fun selectOwner() {
        if (registers[registerId]?.snapshot != null) return
        registerId = registers.entries.filter { it.value.snapshot != null }.minByOrNull { it.value.firstSeen }?.key
    }
}

private fun snapshotTime(snapshot: MirrorOrderSnapshot): Long? = try {
    Instant.parse(snapshot.updatedAt).toEpochMilli()
} catch (_: Exception) { null }

fun isValidMirrorSnapshot(snapshot: MirrorOrderSnapshot): Boolean =
    snapshot.version == 1 && snapshotTime(snapshot) != null && snapshot.itemCount > 0 && snapshot.items.isNotEmpty() &&
        snapshot.items.all { it.id.isNotBlank() && it.name.isNotBlank() && it.quantity > 0 &&
            it.unitPrice.isFinite() && it.unitPrice >= 0 && it.lineTotal.isFinite() && it.lineTotal >= 0 } &&
        snapshot.items.sumOf { it.quantity } == snapshot.itemCount &&
        listOf(snapshot.subtotal, snapshot.discount, snapshot.total).all { it.isFinite() && it >= 0 }
