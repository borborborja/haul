package com.bor_devs.shoplist.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.AppMode
import com.bor_devs.shoplist.domain.ShopItem
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.theme.categoryColor

// Uniform soft outer glow on every edge (offset 0,0) — not a directional drop
// shadow — so the card looks like it has an even halo around the whole border.
private fun Modifier.cardGlow(corner: Dp, color: Color, blur: Dp): Modifier = drawBehind {
    val r = corner.toPx()
    val paint = android.graphics.Paint().apply {
        this.color = android.graphics.Color.TRANSPARENT
        setShadowLayer(blur.toPx(), 0f, 0f, color.toArgb())
    }
    drawIntoCanvas { it.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, r, r, paint) }
}

private val CardGlow = Color(0x26000000)

@Composable
fun ItemRow(
    item: ShopItem,
    mode: AppMode,
    categoryIcon: String,
    compact: Boolean,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    onEditNote: () -> Unit,
    onRemoveFromList: () -> Unit,
    onAddBack: () -> Unit,
) {
    val t = LocalStrings.current
    var menuOpen by remember { mutableStateOf(false) }
    val vPad = if (compact) 4.dp else 8.dp

    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth().cardGlow(16.dp, CardGlow, 16.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clickable { onToggle() }
                .padding(start = 6.dp, end = 4.dp, top = vPad, bottom = vPad),
        ) {
            Box(
                Modifier
                    .padding(end = 8.dp)
                    .width(5.dp)
                    .height(if (compact) 22.dp else 32.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(categoryColor(item.category)),
            )
            // Shopping mode shows the circular checkbox; planning relies on the row menu.
            if (mode == AppMode.SHOPPING) {
                Icon(
                    imageVector = if (item.checked) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (item.checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                    modifier = Modifier.size(if (compact) 22.dp else 26.dp),
                )
                Spacer(Modifier.width(8.dp))
            }
            // Tinted emoji tile (category colour).
            if (categoryIcon.isNotBlank()) {
                Box(
                    Modifier
                        .size(if (compact) 30.dp else 38.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(categoryColor(item.category).copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(categoryIcon, style = if (compact) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.titleMedium)
                }
                Spacer(Modifier.width(10.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(
                    text = item.name,
                    style = if (compact) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodyLarge,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textDecoration = if (item.checked) TextDecoration.LineThrough else null,
                    color = if (item.checked) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                )
                if (item.note.isNotBlank()) {
                    Text(
                        text = item.note,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                val attrib = attributionText(item, t)
                if (attrib.isNotBlank()) {
                    Text(
                        text = attrib,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Box {
                IconButton(onClick = { menuOpen = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = "Menu")
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(text = { Text(t.notes) }, onClick = { menuOpen = false; onEditNote() })
                    if (item.inList) {
                        DropdownMenuItem(text = { Text(t.previouslyUsed) }, onClick = { menuOpen = false; onRemoveFromList() })
                    } else {
                        DropdownMenuItem(text = { Text(t.add) }, onClick = { menuOpen = false; onAddBack() })
                    }
                    DropdownMenuItem(
                        text = { Text(t.delete) },
                        leadingIcon = { Icon(Icons.Filled.Delete, null) },
                        onClick = { menuOpen = false; onDelete() },
                    )
                }
            }
        }
    }
}

@Composable
fun GridItemCard(
    item: ShopItem,
    categoryIcon: String,
    onToggle: () -> Unit,
) {
    Surface(
        color = if (item.checked) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 1.dp,
        modifier = Modifier
            .fillMaxWidth()
            .cardGlow(16.dp, CardGlow, 16.dp)
            .clickable { onToggle() },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(vertical = 14.dp, horizontal = 6.dp),
        ) {
            Text(categoryIcon.ifBlank { "📦" }, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(6.dp))
            Text(
                item.name,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (item.checked) TextDecoration.LineThrough else null,
                color = if (item.checked) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
            val attrib = attributionText(item, LocalStrings.current)
            if (attrib.isNotBlank()) {
                Text(
                    attrib,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
}

/** "Bought by X" for a checked item, else "Added by Y"; "" when unknown. */
private fun attributionText(item: ShopItem, t: com.bor_devs.shoplist.ui.i18n.Strings): String = when {
    item.checked && item.checkedBy.isNotBlank() -> t.boughtByLabel.replace("{x}", item.checkedBy)
    item.addedBy.isNotBlank() -> t.addedByLabel.replace("{x}", item.addedBy)
    else -> ""
}
