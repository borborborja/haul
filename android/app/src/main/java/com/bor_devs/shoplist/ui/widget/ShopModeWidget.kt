package com.bor_devs.shoplist.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalSize
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.bor_devs.shoplist.domain.ShopItem
import com.bor_devs.shoplist.ui.theme.categoryColor

private val Mint = Color(0xFF10B981)
private val MintInk = Color(0xFF06231A)

/**
 * "Shop mode" widget — mirrors the Haul shopping screen. Shows the active
 * list's progress and the *pending* items as round checkboxes; tapping one
 * marks it bought. When everything is bought it shows a done state. Tapping
 * the header opens the app.
 */
class ShopModeWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = WidgetData.appWidgetId(context, id)
        val data = WidgetData.forWidget(context, appWidgetId)
        val inList = data.items.filter { it.inList }
        val pending = inList.filter { !it.checked }

        provideContent {
            GlanceTheme {
                val size = LocalSize.current
                // header ~34dp + progress ~30dp + paddings ~24dp; each row ~40dp
                val maxRows = ((size.height.value - 92) / 40).toInt().coerceAtLeast(1)
                ShopModeContent(
                    listName = data.name,
                    emoji = data.emoji,
                    listId = data.listId,
                    pending = pending.take(maxRows),
                    total = inList.size,
                    checkedCount = inList.count { it.checked },
                    context = context,
                )
            }
        }
    }
}

@Composable
private fun ShopModeContent(
    listName: String,
    emoji: String,
    listId: String,
    pending: List<ShopItem>,
    total: Int,
    checkedCount: Int,
    context: Context,
) {
    val open = actionStartActivity(openListIntent(context, listId))
    val percent = if (total > 0) (checkedCount * 100 / total) else 0

    Column(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(GlanceTheme.colors.surface)
            .padding(14.dp)
            .cornerRadius(20.dp),
    ) {
        // Header: emoji + list name + "Comprar" pill, tap opens the app on this list
        Row(
            modifier = GlanceModifier.fillMaxWidth().clickable(open),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "$emoji ${listName.ifBlank { "Haul" }}",
                style = TextStyle(fontWeight = FontWeight.Bold, color = GlanceTheme.colors.onSurface),
                maxLines = 1,
                modifier = GlanceModifier.defaultWeight(),
            )
            Box(
                modifier = GlanceModifier
                    .background(ColorProvider(Mint))
                    .cornerRadius(9.dp)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Text(text = "Comprar", style = TextStyle(fontWeight = FontWeight.Bold, color = ColorProvider(MintInk)))
            }
        }

        Spacer(modifier = GlanceModifier.height(10.dp))

        // Progress: "checked/total · NN%" + mint bar
        if (total > 0) {
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "$checkedCount/$total",
                    style = TextStyle(fontWeight = FontWeight.Bold, color = GlanceTheme.colors.onSurface),
                )
                Spacer(modifier = GlanceModifier.width(6.dp))
                Text(text = "· $percent%", style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant))
            }
            Spacer(modifier = GlanceModifier.height(6.dp))
            // Track + proportionally-filled portion (Glance can't do fractional
            // widths, so derive a dp width from the widget size and fill %).
            val innerWidth = (LocalSize.current.width.value - 28f).coerceAtLeast(0f)
            val filledWidth = (innerWidth * percent.coerceIn(0, 100) / 100f).dp
            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .background(GlanceTheme.colors.surfaceVariant)
                    .cornerRadius(4.dp),
            ) {
                Box(
                    modifier = GlanceModifier
                        .width(filledWidth)
                        .height(8.dp)
                        .background(ColorProvider(Mint))
                        .cornerRadius(4.dp),
                ) {}
            }
            Spacer(modifier = GlanceModifier.height(10.dp))
        }

        when {
            total == 0 -> Text(
                text = "Llista buida",
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant),
            )
            pending.isEmpty() -> Text(
                text = "🎉 Compra completada!",
                style = TextStyle(fontWeight = FontWeight.Bold, color = ColorProvider(Mint)),
            )
            else -> pending.forEach { item ->
                ShopModeRow(item, open)
                Spacer(modifier = GlanceModifier.height(6.dp))
            }
        }
    }
}

@Composable
private fun ShopModeRow(item: ShopItem, open: androidx.glance.action.Action) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(GlanceTheme.colors.surfaceVariant)
            .cornerRadius(12.dp)
            .padding(horizontal = 10.dp, vertical = 8.dp)
            .clickable(open),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // category color bar
        Box(
            modifier = GlanceModifier
                .width(4.dp)
                .height(22.dp)
                .background(ColorProvider(categoryColor(item.category)))
                .cornerRadius(2.dp),
        ) {}
        Spacer(modifier = GlanceModifier.width(10.dp))
        // round checkbox (empty — tapping marks bought)
        Text(text = "◯", style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant))
        Spacer(modifier = GlanceModifier.width(10.dp))
        Text(
            text = item.name,
            style = TextStyle(fontWeight = FontWeight.Medium, color = GlanceTheme.colors.onSurface),
            maxLines = 1,
        )
    }
}

/** Broadcast receiver for the Shop-mode widget. */
class ShopModeWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ShopModeWidget()
}
