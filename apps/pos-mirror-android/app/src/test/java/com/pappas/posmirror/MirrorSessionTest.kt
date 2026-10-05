package com.pappas.posmirror

import com.pappas.posmirror.data.model.MirrorOrderLine
import com.pappas.posmirror.data.model.MirrorOrderSnapshot
import com.pappas.posmirror.util.MirrorSession
import com.pappas.posmirror.util.MirrorStateUpdate
import org.junit.Assert.*
import org.junit.Test

class MirrorSessionTest {
    private fun cart(minute: Int, total: Double = 12.0) = MirrorOrderSnapshot(
        updatedAt = "2026-10-02T00:${minute.toString().padStart(2, '0')}:00.000Z", itemCount = 1,
        items = listOf(MirrorOrderLine("1", "Fish", 1, total, total)), subtotal = total, total = total
    )

    @Test fun activeRegisterKeepsOwnershipWhileOthersUpdateOrClear() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(1)); session.apply("b", cart(2))
        session.apply("b", MirrorOrderSnapshot()); session.apply("c", cart(3))
        assertEquals("a", session.registerId)
        session.apply("a", cart(4, 20.0))
        assertEquals(20.0, session.snapshot.total, 0.001)
    }

    @Test fun handoffUsesLatestCartAndSkipsClearedRegisters() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(1)); session.apply("b", cart(2)); session.apply("c", cart(3))
        session.apply("b", cart(4, 30.0)); session.apply("a", MirrorOrderSnapshot())
        assertEquals("b", session.registerId)
        assertEquals(30.0, session.snapshot.total, 0.001)
        session.apply("b", MirrorOrderSnapshot())
        assertEquals("c", session.registerId)
        session.apply("c", MirrorOrderSnapshot())
        assertTrue(session.snapshot.isEmpty)
    }

    @Test fun ignoresOldAndMalformedSnapshots() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(3)); session.apply("a", cart(1, 1.0))
        session.apply("a", cart(4).copy(version = 2)); session.apply("a", null)
        assertEquals(12.0, session.snapshot.total, 0.001)
    }

    @Test fun staleFetchCannotClearRealtimeUpdatesOrMissingNewRegisters() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(1))
        val revision = session.revision
        session.apply("a", cart(2, 20.0)); session.apply("b", cart(3))
        session.refresh(listOf(MirrorStateUpdate("a", MirrorOrderSnapshot())), revision)
        assertEquals("a", session.registerId)
        assertEquals(20.0, session.snapshot.total, 0.001)
        session.apply("a", MirrorOrderSnapshot())
        assertEquals("b", session.registerId)
    }

    @Test fun staleFetchCannotResurrectClearedCart() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(1))
        val revision = session.revision
        session.apply("a", MirrorOrderSnapshot())
        session.refresh(listOf(MirrorStateUpdate("a", cart(1))), revision)
        assertTrue(session.snapshot.isEmpty)
    }

    @Test fun refreshClearsMissingRowsBeforeHandoffAndPreservesOwner() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(1)); session.apply("b", cart(2)); session.apply("c", cart(3))
        session.refresh(listOf(MirrorStateUpdate("a", cart(4)), MirrorStateUpdate("c", cart(3))), session.revision)
        assertEquals("a", session.registerId)
        session.refresh(listOf(MirrorStateUpdate("c", cart(3))), session.revision)
        assertEquals("c", session.registerId)
    }

    @Test fun initialFetchChoosesByTimeThenId() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.refresh(listOf(MirrorStateUpdate("z", cart(2)), MirrorStateUpdate("b", cart(1)), MirrorStateUpdate("a", cart(1))), 0)
        assertEquals("a", session.registerId)
    }

    @Test fun newCartOnWaitingRegisterLosesOldQueuePosition() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(1)); session.apply("b", cart(2)); session.apply("c", cart(3))
        session.apply("b", MirrorOrderSnapshot()); session.apply("b", cart(4)); session.apply("a", MirrorOrderSnapshot())
        assertEquals("c", session.registerId)
    }
    @Test fun duplicateRealtimeUpdateFencesAnOlderEmptyFetch() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli() }
        session.apply("a", cart(1))
        val revision = session.revision
        session.apply("a", cart(1))
        session.refresh(listOf(MirrorStateUpdate("a", MirrorOrderSnapshot())), revision)
        assertEquals("a", session.registerId)
    }

    @Test fun excludesStaleFetchedAndLiveCartsButAcceptsFreshUpdates() {
        val session = MirrorSession { java.time.Instant.parse("2026-10-02T00:07:00Z").toEpochMilli() }
        session.refresh(listOf(MirrorStateUpdate("a", cart(1))), 0)
        assertTrue(session.snapshot.isEmpty)
        session.apply("b", cart(1))
        assertTrue(session.snapshot.isEmpty)
        session.apply("a", cart(3)); session.apply("a", cart(1))
        assertEquals("a", session.registerId)
    }

    @Test fun expiresAfterFiveMinutesAndSkipsStaleWaitingCartsWithoutRenewingDuplicates() {
        var now = java.time.Instant.parse("2026-10-02T00:05:00Z").toEpochMilli()
        val session = MirrorSession { now }
        session.apply("a", cart(1)); session.apply("b", cart(1)); session.apply("c", cart(4))
        now += 60_000
        session.expire()
        assertEquals("a", session.registerId)
        session.apply("a", cart(1))
        now++
        session.expire()
        assertEquals("c", session.registerId)
        session.apply("c", MirrorOrderSnapshot()); session.apply("a", cart(1))
        assertTrue(session.snapshot.isEmpty)
    }
}
