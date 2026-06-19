package com.bor_devs.shoplist.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bor_devs.shoplist.domain.SavedList
import com.bor_devs.shoplist.ui.i18n.LocalStrings

private val SHEET_EMOJIS = listOf("🛒", "🏠", "🎉", "🏖️", "🍝", "🎄", "🧺", "🐣", "💼", "🍕", "🥗", "🎁")
private val Mint = Color(0xFF10B981)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListSwitcherSheet(
    lists: List<SavedList>,
    activeListId: String,
    counts: Map<String, Pair<Int, Int>>,
    onSwitch: (String) -> Unit,
    onCreate: (String, String) -> Unit,
    onDelete: (String) -> Unit,
    onJoinByCode: () -> Unit,
    onDismiss: () -> Unit,
) {
    val t = LocalStrings.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var creating by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newEmoji by remember { mutableStateOf("🛒") }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 28.dp)) {
            Text(
                t.myLists,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(bottom = 14.dp),
            )

            lists.forEach { l ->
                val isActive = l.id == activeListId
                val (done, total) = counts[l.id] ?: (0 to 0)
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = if (isActive) Mint.copy(alpha = 0.10f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    border = if (isActive) androidx.compose.foundation.BorderStroke(1.5.dp, Mint) else null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                        .clickable { onSwitch(l.id); onDismiss() },
                ) {
                    Row(
                        Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surface),
                            contentAlignment = Alignment.Center,
                        ) { Text(l.emoji, fontSize = 20.sp) }
                        Spacer(Modifier.width(13.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                l.name ?: t.myLists,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                            )
                            Text(
                                "$done / $total · ${if (!l.isLocal) t.listSynced else t.listLocal}",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (!l.isLocal) Mint else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (isActive) {
                            Box(
                                Modifier.size(26.dp).clip(CircleShape).background(Mint),
                                contentAlignment = Alignment.Center,
                            ) { Icon(Icons.Filled.Check, null, tint = Color(0xFF06231A), modifier = Modifier.size(15.dp)) }
                        } else {
                            if (lists.size > 1) {
                                IconButton(onClick = { onDelete(l.id) }, modifier = Modifier.size(32.dp)) {
                                    Icon(Icons.Filled.Delete, "Esborra", modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Icon(Icons.Filled.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            if (creating) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 10.dp)) {
                    items(SHEET_EMOJIS) { e ->
                        Box(
                            Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (newEmoji == e) Mint.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                                .then(if (newEmoji == e) Modifier.border(2.dp, Mint, RoundedCornerShape(10.dp)) else Modifier)
                                .clickable { newEmoji = e },
                            contentAlignment = Alignment.Center,
                        ) { Text(e, fontSize = 18.sp) }
                    }
                }
                OutlinedTextField(
                    value = newName,
                    onValueChange = { newName = it },
                    placeholder = { Text(t.listNameHint) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                    keyboardActions = KeyboardActions(onDone = { onCreate(newName.trim(), newEmoji); onDismiss() }),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = { creating = false }, modifier = Modifier.weight(1f)) { Text(t.cancel) }
                    Button(
                        onClick = { onCreate(newName.trim(), newEmoji); onDismiss() },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Color.White),
                    ) { Text(t.listCreate) }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { creating = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Color.White),
                    ) {
                        Icon(Icons.Filled.Add, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(t.newList)
                    }
                    OutlinedButton(onClick = { onJoinByCode(); onDismiss() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(t.listCodeBtn)
                    }
                }
            }
        }
    }
}
