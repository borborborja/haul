package com.bor_devs.shoplist.ui.i18n

import androidx.compose.runtime.Composable
import com.bor_devs.shoplist.domain.Category

fun Strings.categoryName(category: Category): String = category.displayName?.takeIf { it.isNotBlank() }
    ?: cats[category.key] ?: category.key

data class ProductStrings(
    val newProduct: String = "New product",
    val editProduct: String = "Edit product",
    val productName: String = "Product name",
    val quantity: String = "Quantity (optional)",
    val quantityHint: String = "2, 500 g, 1 pack…",
    val createAndAdd: String = "Create and add",
    val saveToCatalog: String = "Save to catalog",
    val addToList: String = "Also add to this shopping list",
    val saveNext: String = "Save and add another",
    val pasteHint: String = "Paste several products, one per line. Category, quantity and notes apply to all.",
    val createMany: String = "Create products",
    val added: String = "Added to the list",
    val alreadyInList: String = "Already in the list",
    val alreadyExists: String = "This product already exists in the catalog",
    val savedLocal: String = "Saved on this device",
    val pending: String = "Saved · waiting to sync",
    val synced: String = "Saved and synced",
    val failed: String = "Could not save. Your text is kept; try again.",
    val retry: String = "Retry",
    val syncChanges: String = "Sync pending changes",
    val hide: String = "Hide from catalog",
    val hidden: String = "Hidden from catalog. Shopping items are kept.",
    val shown: String = "Shown in catalog",
    val undo: String = "Undo",
    val editCatalog: String = "Also update my custom catalog product",
    val editCatalogHint: String = "Otherwise, changes apply only to this shopping item.",
    val required: String = "Enter a product name",
    val categoryRequired: String = "Choose a category",
    val categoryExists: String = "A category with this name already exists",
    val nameTooLong: String = "The name is too long",
    val quantityTooLong: String = "The quantity is too long",
    val noteTooLong: String = "The notes are too long",
    val permission: String = "Your access does not allow this action",
    val listChanged: String = "The list changed. Open the product again.",
    val batchLimit: String = "Paste up to 100 products at a time",
    val results: String = "Results",
    val done: String = "Done",
    val removeFromList: String = "Remove from this list",
    val noMatches: String = "No matching products",
    val createNamed: String = "Create “{name}”",
    val search: String = "Search for a product",
    val clearSearch: String = "Clear search",
    val readOnly: String = "This link allows viewing only",
    val checkOnly: String = "This link allows checking off items only",
    val bulkCount: String = "{count} products",
    val batchDuplicate: String = "Repeated in pasted text",
    val edit: String = "Edit",
    val notes: String = "Notes (optional)",
    val useExisting: String = "Add existing product",
    val categoryNameTooLong: String = "Use up to 80 characters for the category name",
    val syncFailure: String = "Saved on this device, but could not sync. Try again.",
    val quantityUnavailable: String = "Quantity is saved on this device. Update the server to sync it.",
)

private val EN_PRODUCTS = ProductStrings()
private val CA_PRODUCTS = ProductStrings(
    newProduct = "Nou producte", editProduct = "Edita el producte", productName = "Nom del producte",
    quantity = "Quantitat (opcional)", quantityHint = "2, 500 g, 1 paquet…",
    createAndAdd = "Crea i afegeix", saveToCatalog = "Desa al catàleg", addToList = "Afegeix també a aquesta llista de compra",
    saveNext = "Desa i afegeix-ne un altre", pasteHint = "Enganxa diversos productes, un per línia. La categoria, la quantitat i les notes s'apliquen a tots.",
    createMany = "Crea els productes", added = "Afegit a la llista", alreadyInList = "Ja és a la llista",
    alreadyExists = "Aquest producte ja existeix al catàleg", savedLocal = "Desat en aquest dispositiu",
    pending = "Desat · pendent de sincronitzar", synced = "Desat i sincronitzat",
    failed = "No s'ha pogut desar. Conservem el text; torna-ho a provar.", retry = "Torna-ho a provar", syncChanges = "Sincronitza els canvis pendents",
    hide = "Amaga del catàleg", hidden = "Amagat del catàleg. Es conserven els productes de compra.", shown = "Visible al catàleg", undo = "Desfés",
    editCatalog = "Actualitza també el meu producte personalitzat al catàleg", editCatalogHint = "Altrament, els canvis només afecten aquest producte de compra.",
    required = "Escriu el nom del producte", categoryRequired = "Selecciona una categoria", categoryExists = "Ja existeix una categoria amb aquest nom",
    nameTooLong = "El nom és massa llarg", quantityTooLong = "La quantitat és massa llarga", noteTooLong = "Les notes són massa llargues",
    permission = "El teu accés no permet aquesta acció", listChanged = "La llista ha canviat. Torna a obrir el producte.",
    batchLimit = "Enganxa un màxim de 100 productes cada vegada", results = "Resultats", done = "Fet",
    removeFromList = "Treu d'aquesta llista", noMatches = "Cap producte coincideix", createNamed = "Crea «{name}»",
    search = "Cerca un producte", clearSearch = "Esborra la cerca", readOnly = "Aquest enllaç només permet consultar", checkOnly = "Aquest enllaç només permet marcar productes comprats",
    bulkCount = "{count} productes", batchDuplicate = "Repetit al text enganxat", edit = "Edita", notes = "Notes (opcionals)",
    useExisting = "Afegeix el producte existent", categoryNameTooLong = "El nom de categoria pot tenir fins a 80 caràcters",
    syncFailure = "Desat en aquest dispositiu, però no s'ha pogut sincronitzar. Torna-ho a provar.",
    quantityUnavailable = "La quantitat es conserva en aquest dispositiu. Actualitza el servidor per sincronitzar-la.",
)
private val ES_PRODUCTS = ProductStrings(
    newProduct = "Nuevo producto", editProduct = "Editar producto", productName = "Nombre del producto",
    quantity = "Cantidad (opcional)", quantityHint = "2, 500 g, 1 paquete…",
    createAndAdd = "Crear y añadir", saveToCatalog = "Guardar en el catálogo", addToList = "Añadir también a esta lista de compra",
    saveNext = "Guardar y añadir otro", pasteHint = "Pega varios productos, uno por línea. La categoría, la cantidad y las notas se aplican a todos.",
    createMany = "Crear productos", added = "Añadido a la lista", alreadyInList = "Ya está en la lista",
    alreadyExists = "Este producto ya existe en el catálogo", savedLocal = "Guardado en este dispositivo",
    pending = "Guardado · pendiente de sincronizar", synced = "Guardado y sincronizado",
    failed = "No se ha podido guardar. Conservamos el texto; inténtalo de nuevo.", retry = "Reintentar", syncChanges = "Sincronizar cambios pendientes",
    hide = "Ocultar del catálogo", hidden = "Oculto del catálogo. Se conservan los productos de compra.", shown = "Visible en el catálogo", undo = "Deshacer",
    editCatalog = "Actualizar también mi producto personalizado en el catálogo", editCatalogHint = "Si no, los cambios solo afectan a este producto de compra.",
    required = "Escribe el nombre del producto", categoryRequired = "Selecciona una categoría", categoryExists = "Ya existe una categoría con este nombre",
    nameTooLong = "El nombre es demasiado largo", quantityTooLong = "La cantidad es demasiado larga", noteTooLong = "Las notas son demasiado largas",
    permission = "Tu acceso no permite esta acción", listChanged = "La lista ha cambiado. Vuelve a abrir el producto.",
    batchLimit = "Pega un máximo de 100 productos cada vez", results = "Resultados", done = "Hecho",
    removeFromList = "Quitar de esta lista", noMatches = "Ningún producto coincide", createNamed = "Crear «{name}»",
    search = "Buscar un producto", clearSearch = "Borrar búsqueda", readOnly = "Este enlace solo permite consultar", checkOnly = "Este enlace solo permite marcar productos comprados",
    bulkCount = "{count} productos", batchDuplicate = "Repetido en el texto pegado", edit = "Editar", notes = "Notas (opcionales)",
    useExisting = "Añadir el producto existente", categoryNameTooLong = "El nombre de categoría puede tener hasta 80 caracteres",
    syncFailure = "Guardado en este dispositivo, pero no se ha podido sincronizar. Inténtalo de nuevo.",
    quantityUnavailable = "La cantidad se conserva en este dispositivo. Actualiza el servidor para sincronizarla.",
)

@Composable
fun productStrings(): ProductStrings = when (LocalAppLang.current.code) {
    "ca" -> CA_PRODUCTS
    "es" -> ES_PRODUCTS
    else -> EN_PRODUCTS
}

internal fun ProductStrings.commandError(code: String?): String = when (code) {
    "NAME_REQUIRED" -> required
    "NAME_TOO_LONG" -> nameTooLong
    "CATEGORY_REQUIRED", "CATEGORY_NOT_FOUND" -> categoryRequired
    "QUANTITY_TOO_LONG" -> quantityTooLong
    "NOTE_TOO_LONG" -> noteTooLong
    "DUPLICATE", "DUPLICATE_CATALOG" -> alreadyExists
    "DUPLICATE_LIST" -> alreadyInList
    "PERMISSION", "FORBIDDEN" -> permission
    "LIST_CHANGED", "SCOPE_CHANGED" -> listChanged
    "SYNC_REJECTED" -> syncFailure
    "QUANTITY_UNSUPPORTED" -> quantityUnavailable
    else -> if (code?.startsWith("HTTP_") == true) syncFailure else failed
}
