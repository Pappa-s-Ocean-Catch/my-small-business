package com.pappas.posmirror

import com.google.gson.Gson
import com.pappas.posmirror.data.model.MirrorOrderSnapshot
import org.junit.Assert.*
import org.junit.Test

class SnapshotTest {
    private val gson = Gson()

    @Test
    fun testParseSnapshotWithItems() {
        val json = """
            {
                "version": 1,
                "updatedAt": "2026-10-01T06:00:00.000Z",
                "itemCount": 3,
                "items": [
                    {
                        "id": "item-1",
                        "name": "Fish & Chips",
                        "quantity": 2,
                        "unitPrice": 16.50,
                        "lineTotal": 33.00,
                        "customizations": [
                            {"label": "Extra Tartare Sauce"},
                            {"label": "Lemon Wedge"}
                        ]
                    },
                    {
                        "id": "item-2",
                        "name": "Coke Zero",
                        "quantity": 1,
                        "unitPrice": 4.50,
                        "lineTotal": 4.50
                    }
                ],
                "subtotal": 37.50,
                "discount": 2.50,
                "total": 35.00
            }
        """.trimIndent()

        val snapshot = gson.fromJson(json, MirrorOrderSnapshot::class.java)
        assertNotNull(snapshot)
        assertFalse(snapshot.isEmpty)
        assertEquals(3, snapshot.itemCount)
        assertEquals(2, snapshot.items.size)
        assertEquals("Fish & Chips", snapshot.items[0].name)
        assertEquals(2, snapshot.items[0].quantity)
        assertEquals(2, snapshot.items[0].customizations?.size)
        assertEquals("Extra Tartare Sauce", snapshot.items[0].customizations?.get(0)?.label)
        assertEquals(35.00, snapshot.total, 0.001)
    }

    @Test
    fun testParseEmptySnapshot() {
        val json = "{}"
        val snapshot = gson.fromJson(json, MirrorOrderSnapshot::class.java)
        assertTrue(snapshot.isEmpty)
    }
}
