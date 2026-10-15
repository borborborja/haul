package com.bor_devs.shoplist

import com.bor_devs.shoplist.domain.*
import org.junit.Assert.*
import org.junit.Test

class ProductCommandValidationTest {
    @Test fun duplicateNormalizationPreservesPunctuationButIgnoresAccentsAndSpacing() {
        assertEquals(normalizeProductName("  Préssec   blanc "), normalizeProductName("pressec blanc"))
        assertNotEquals(normalizeProductName("1.5 l"), normalizeProductName("15 l"))
    }
    @Test fun fieldLimitsCountUnicodeCharacters() {
        assertNull(validateProduct("🍎".repeat(200), "fruit", "2 kg", ""))
        assertEquals("NAME_TOO_LONG", validateProduct("🍎".repeat(201), "fruit", "", ""))
        assertEquals("QUANTITY_TOO_LONG", validateProduct("Milk", "dairy", "x".repeat(81), ""))
        assertEquals("NOTE_TOO_LONG", validateProduct("Milk", "dairy", "", "x".repeat(1001)))
    }
    @Test fun hidingAGlobalProductDoesNotHideItsCustomVariant() {
        val base = LocalizedItem("Milk", "Llet", "Milk", "base-id", "global", "dairy")
        val variant = base.copy(sourceId = "variant-id", sourceKind = "custom")
        assertNotEquals(catalogVisibilityKey(base), catalogVisibilityKey(variant))
    }
}
