package com.bor_devs.shoplist.wear.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
import com.bor_devs.shoplist.wear.WearPaths
import com.bor_devs.shoplist.wear.WearRepo
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

private val Mint = Color(0xFF10B981)

class WearMainActivity : ComponentActivity() {
    private val dataClient by lazy { Wearable.getDataClient(this) }
    private val messageClient by lazy { Wearable.getMessageClient(this) }
    private val nodeClient by lazy { Wearable.getNodeClient(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { WearApp(::toggle) }
        sendToNodes(WearPaths.REQUEST, ByteArray(0))
        loadLatest()
    }

    override fun onResume() {
        super.onResume()
        loadLatest()
    }

    private fun loadLatest() {
        dataClient.dataItems.addOnSuccessListener { buffer ->
            try {
                buffer.forEach { di ->
                    if (di.uri.path == WearPaths.LIST) {
                        val map = DataMapItem.fromDataItem(di).dataMap
                        WearRepo.apply(
                            map.getString(WearPaths.KEY_LIST_NAME, "Haul"),
                            map.getString(WearPaths.KEY_ITEMS, "[]"),
                        )
                    }
                }
            } finally {
                buffer.release()
            }
        }
    }

    private fun toggle(id: String) {
        WearRepo.optimisticToggle(id)
        sendToNodes(WearPaths.TOGGLE, id.toByteArray())
    }

    private fun sendToNodes(path: String, payload: ByteArray) {
        nodeClient.connectedNodes.addOnSuccessListener { nodes ->
            nodes.forEach { messageClient.sendMessage(it.id, path, payload) }
        }
    }
}

@Composable
private fun WearApp(onToggle: (String) -> Unit) {
    val snap by WearRepo.snapshot.collectAsStateWithLifecycle()
    val listState = rememberScalingLazyListState()
    val items = snap?.items ?: emptyList()
    val pending = items.filter { !it.checked }
    val total = items.size
    val done = items.count { it.checked }

    MaterialTheme {
        Scaffold(
            timeText = { TimeText() },
            vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
            positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
        ) {
            ScalingLazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                item {
                    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = snap?.listName ?: "Haul",
                            style = MaterialTheme.typography.title3,
                            color = Color.White,
                            maxLines = 1,
                            textAlign = TextAlign.Center,
                        )
                        if (total > 0) {
                            Text("$done/$total", style = MaterialTheme.typography.caption1, color = Mint)
                        }
                    }
                }
                when {
                    snap == null -> item {
                        Text("…", style = MaterialTheme.typography.body1, color = Color.Gray, modifier = Modifier.padding(top = 8.dp))
                    }
                    pending.isEmpty() -> item {
                        Text("🎉", style = MaterialTheme.typography.display3, modifier = Modifier.padding(top = 8.dp))
                    }
                    else -> items(pending, key = { it.id }) { item ->
                        Chip(
                            onClick = { onToggle(item.id) },
                            label = { Text(item.name, maxLines = 2) },
                            colors = ChipDefaults.secondaryChipColors(),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }
}
