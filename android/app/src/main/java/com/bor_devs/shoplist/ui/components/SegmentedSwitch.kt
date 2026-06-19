package com.bor_devs.shoplist.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

/** One segment of a [SegmentedIconSwitch]. */
data class SegmentOption<T>(
    val value: T,
    val icon: ImageVector,
    val contentDescription: String,
)

/**
 * Compact segmented control rendered as a pill of icon buttons, matching the
 * Plan/Shop toggle in the top bar. The selected segment gets a filled chip.
 */
@Composable
fun <T> SegmentedIconSwitch(
    options: List<SegmentOption<T>>,
    selected: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .padding(2.dp),
    ) {
        options.forEach { opt ->
            val isSelected = opt.value == selected
            val bg by animateColorAsState(
                if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
                label = "segBg",
            )
            val fg by animateColorAsState(
                if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                label = "segFg",
            )
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(bg)
                    .clickable { if (!isSelected) onSelect(opt.value) }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            ) {
                Icon(
                    opt.icon,
                    contentDescription = opt.contentDescription,
                    tint = fg,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}
