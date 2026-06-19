package com.bor_devs.shoplist.ui.widget

import android.content.ComponentName
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalSize
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
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
import com.bor_devs.shoplist.MainActivity
import com.bor_devs.shoplist.data.local.ItemEntity
import com.bor_devs.shoplist.domain.ShopItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Resizable shopping list widget. Shows active items (inList=true) with
 * checkboxes, a progress bar, and the list name. Tapping a checkbox toggles
 * the item. Tapping the header opens the app.
 */
class ShoppingListWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: androidx.glance.GlanceId) {
        val db = WidgetDatabase.get(context)
        val entities: List<ItemEntity> = withContext(Dispatchers.IO) {
            db.itemDao().getAll()
        }
        val items = entities.map { it.toDomain() }
        val inList = items.filter { it.inList }
        val listName = getListName(context)

        provideContent {
            GlanceTheme {
                val size = LocalSize.current
                // Estimate visible items: header ~40dp, progress ~24dp, padding ~24dp, each row ~48dp
                val maxVisibleItems = ((size.height.value - 88) / 48).toInt().coerceAtLeast(1)

                ShoppingListWidgetContent(
                    listName = listName,
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
    listName: String?,
    items: List<ShopItem>,
    total: Int,
    checkedCount: Int,
    context: Context,
) {
    val component = ComponentName(context, MainActivity::class.java)

    Column(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(GlanceTheme.colors.surface)
            .padding(12.dp)
            .cornerRadius(16.dp),
    ) {
        // Header: list name + tap to open app
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .clickable(actionStartActivity(component)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = listName?.ifBlank { "ShoppingList" } ?: "ShoppingList",
                style = TextStyle(
                    fontWeight = FontWeight.Bold,
                    color = GlanceTheme.colors.onSurface,
                ),
            )
        }

        Spacer(modifier = GlanceModifier.height(8.dp))

        // Progress bar
        if (total > 0) {
            val progress = checkedCount.toFloat() / total
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "$checkedCount/$total",
                    style = TextStyle(
                        color = GlanceTheme.colors.onSurfaceVariant,
                    ),
                )
                Spacer(modifier = GlanceModifier.width(8.dp))
                // Progress bar background
                Row(
                    modifier = GlanceModifier
                        .defaultWeight()
                        .height(6.dp)
                        .background(GlanceTheme.colors.surfaceVariant)
                        .cornerRadius(3.dp),
                ) {
                    // Filled portion
                    Row(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .background(ColorProvider(Color(0xFF10B981)))
                            .cornerRadius(3.dp),
                    ) {}
                }
            }
            Spacer(modifier = GlanceModifier.height(8.dp))
        }

        // Empty state
        if (items.isEmpty()) {
            Text(
                text = "Your list is empty",
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant),
            )
        }

        // Item rows with checkboxes
        items.forEach { item ->
            ItemWidgetRow(item = item)
            Spacer(modifier = GlanceModifier.height(4.dp))
        }
    }
}

@Composable
private fun ItemWidgetRow(item: ShopItem) {
    val toggleAction = actionRunCallback<ToggleCheckAction>(
        actionParametersOf(ToggleCheckAction.Key to item.id)
    )

    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Category color indicator
        Row(
            modifier = GlanceModifier
                .width(4.dp)
                .height(24.dp)
                .background(ColorProvider(Color(0xFF6366F1)))
                .cornerRadius(2.dp),
        ) {}

        Spacer(modifier = GlanceModifier.width(8.dp))

        // Checkbox (unicode characters with clickable action)
        Text(
            text = if (item.checked) "☑" else "☐",
            style = TextStyle(
                color = if (item.checked)
                    ColorProvider(Color(0xFF10B981))
                else
                    GlanceTheme.colors.onSurfaceVariant,
            ),
            modifier = GlanceModifier.clickable(toggleAction),
        )

        Spacer(modifier = GlanceModifier.width(8.dp))

        // Item name
        Text(
            text = item.name,
            style = TextStyle(
                color = if (item.checked)
                    GlanceTheme.colors.onSurfaceVariant
                else
                    GlanceTheme.colors.onSurface,
            ),
            maxLines = 1,
        )
    }
}

/** Broadcast receiver for the Shopping List widget. */
class ShoppingListWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ShoppingListWidget()
}
