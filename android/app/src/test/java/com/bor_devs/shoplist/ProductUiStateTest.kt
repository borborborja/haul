package com.bor_devs.shoplist

import com.bor_devs.shoplist.ui.normalizedProductName
import com.bor_devs.shoplist.ui.productNames
import org.junit.Assert.*
import org.junit.Test

class ProductUiStateTest {
    @Test fun searchMatchesAccentsCaseAndRepeatedWhitespace() {
        assertEquals(normalizedProductName("  CAFÈ   amb  LLET  "), normalizedProductName("cafe amb llet"))
        assertEquals(normalizedProductName("Café"), normalizedProductName("Cafe\u0301"))
    }

    @Test fun pasteKeepsProductBoundariesAndOmitsEmptyLines() {
        assertEquals(listOf("Llet sencera", "Pa", "Cafè"), productNames(" Llet   sencera \r\n\nPa\n Cafè \n"))
    }
}
