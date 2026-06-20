package com.bor_devs.shoplist.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.clickable
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
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
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Compact 1x1 progress widget. Shows checked/total for the configured list with
 * a progress bar + the list name. Tapping opens the app on that list.
 */
class ShoppingProgressWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = WidgetData.appWidgetId(context, id)
        val data = WidgetData.forWidget(context, appWidgetId)
        val inList = data.items.filter { it.inList }
        val total = inList.size
        val checkedCount = inList.count { it.checked }

        provideContent {
            GlanceTheme {
                Column(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .background(GlanceTheme.colors.surface)
                        .padding(12.dp)
                        .cornerRadius(16.dp)
                        .clickable(actionStartActivity(openListIntent(context, data.listId))),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // List name
                    Text(
                        text = "${data.emoji} ${data.name.ifBlank { "Haul" }}",
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            color = GlanceTheme.colors.onSurface,
                        ),
                        maxLines = 1,
                    )

                    Spacer(modifier = GlanceModifier.height(8.dp))

                    // Large count display
                    Text(
                        text = "$checkedCount/$total",
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(Color(0xFF10B981)),
                        ),
                    )

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    // Mini progress bar
                    val progress = if (total > 0) checkedCount.toFloat() / total else 0f
                    Row(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .background(GlanceTheme.colors.surfaceVariant)
                            .cornerRadius(2.dp),
                    ) {
                        if (total > 0) {
                            Row(
                                modifier = GlanceModifier
                                    .fillMaxWidth()
                                    .height(4.dp)
                                    .background(ColorProvider(Color(0xFF10B981)))
                                    .cornerRadius(2.dp),
                            ) {}
                        }
                    }

                    if (total > 0) {
                        Spacer(modifier = GlanceModifier.height(4.dp))
                        val progressPercent = (progress * 100).toInt()
                        Text(
                            text = "$progressPercent%",
                            style = TextStyle(
                                color = GlanceTheme.colors.onSurfaceVariant,
                            ),
                        )
                    } else {
                        Spacer(modifier = GlanceModifier.height(4.dp))
                        Text(
                            text = "Empty",
                            style = TextStyle(
                                color = GlanceTheme.colors.onSurfaceVariant,
                            ),
                        )
                    }
                }
            }
        }
    }
}

/** Broadcast receiver for the Shopping Progress widget. */
class ShoppingProgressWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ShoppingProgressWidget()
}
