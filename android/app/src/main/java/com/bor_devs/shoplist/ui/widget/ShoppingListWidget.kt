package com.bor_devs.shoplist.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalSize
import androidx.glance.action.Action
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.ShopItem
import com.bor_devs.shoplist.ui.theme.categoryColor

private val Mint = Color(0xFF10B981)

/**
 * Resizable shopping list widget. Shows the configured list's active items with
 * a progress bar + the list name. Tapping opens the app on that list.
 */
class ShoppingListWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = WidgetData.appWidgetId(context, id)
        val data = WidgetData.forWidget(context, appWidgetId)
        val inList = data.items.filter { it.inList }

        provideContent {
            GlanceTheme {
                val size = LocalSize.current
                val maxVisibleItems = ((size.height.value - 88) / 48).toInt().coerceAtLeast(1)
                ShoppingListWidgetContent(
                    listName = data.name,
                    emoji = data.emoji,
                    listId = data.listId,
                    items = inList.take(maxVisibleItems),
                    total = inList.size,
                    checkedCount = inList.count { it.checked },
                    context = context,
                )
            }
        }
    }
}

@Composable
private fun ShoppingListWidgetContent(
    listName: String,
    emoji: String,
    listId: String,
    items: List<ShopItem>,
    total: Int,
    checkedCount: Int,
    context: Context,
) {
    val open = actionStartActivity(openListIntent(context, listId))

    Column(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(GlanceTheme.colors.surface)
            .padding(12.dp)
            .cornerRadius(16.dp)
            .clickable(open),
    ) {
        Text(
            text = "$emoji ${listName.ifBlank { "Haul" }}",
            style = TextStyle(fontWeight = FontWeight.Bold, color = GlanceTheme.colors.onSurface),
            maxLines = 1,
        )

        Spacer(modifier = GlanceModifier.height(8.dp))

        if (total > 0) {
            val percent = checkedCount * 100 / total
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(text = "$checkedCount/$total", style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant))
                Spacer(modifier = GlanceModifier.width(8.dp))
                val innerWidth = (LocalSize.current.width.value - 24f - 48f).coerceAtLeast(0f)
                Box(
                    modifier = GlanceModifier.defaultWeight().height(6.dp)
                        .background(GlanceTheme.colors.surfaceVariant).cornerRadius(3.dp),
                ) {
                    Box(
                        modifier = GlanceModifier.width((innerWidth * percent / 100f).dp).height(6.dp)
                            .background(ColorProvider(Mint)).cornerRadius(3.dp),
                    ) {}
                }
            }
            Spacer(modifier = GlanceModifier.height(8.dp))
        }

        if (items.isEmpty()) {
            Text(text = "Llista buida", style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant))
        }

        items.forEach { item ->
            ItemWidgetRow(item, open)
            Spacer(modifier = GlanceModifier.height(4.dp))
        }
    }
}

@Composable
private fun ItemWidgetRow(item: ShopItem, open: Action) {
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 4.dp).clickable(open),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = GlanceModifier.width(4.dp).height(24.dp)
                .background(ColorProvider(categoryColor(item.category))).cornerRadius(2.dp),
        ) {}
        Spacer(modifier = GlanceModifier.width(8.dp))
        Text(
            text = if (item.checked) "☑" else "☐",
            style = TextStyle(color = if (item.checked) ColorProvider(Mint) else GlanceTheme.colors.onSurfaceVariant),
        )
        Spacer(modifier = GlanceModifier.width(8.dp))
        Text(
            text = item.name,
            style = TextStyle(color = if (item.checked) GlanceTheme.colors.onSurfaceVariant else GlanceTheme.colors.onSurface),
            maxLines = 1,
        )
    }
}

/** Broadcast receiver for the Shopping List widget. */
class ShoppingListWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ShoppingListWidget()
}
