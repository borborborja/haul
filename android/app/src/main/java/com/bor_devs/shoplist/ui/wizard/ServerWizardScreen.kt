package com.bor_devs.shoplist.ui.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bor_devs.shoplist.ui.MainViewModel
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import kotlinx.coroutines.launch

private enum class TestState { IDLE, TESTING, OK, FAIL }

private val Mint = Color(0xFF10B981)
private val MintInk = Color(0xFF06231A)

@Composable
fun ServerWizardScreen(vm: MainViewModel, onDone: () -> Unit) {
    val t = LocalStrings.current
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf("https://shoppinglist.bor-devs.app") }
    var state by remember { mutableStateOf(TestState.IDLE) }

    Column(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .verticalScroll(rememberScrollState())
            .padding(28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        // Brand badge
        Box(
            Modifier.size(60.dp).clip(RoundedCornerShape(19.dp)).background(Mint),
            contentAlignment = Alignment.Center,
        ) { Text("🛒", fontSize = 30.sp) }
        Spacer(Modifier.height(28.dp))

        Text(t.wizardTitle, style = MaterialTheme.typography.displayMedium)
        Spacer(Modifier.height(12.dp))
        Text(
            t.wizardSubtitle,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(28.dp))

        Text(
            t.serverUrl.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = url,
            onValueChange = { url = it; state = TestState.IDLE },
            placeholder = { Text(t.serverUrlHint) },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        when (state) {
            TestState.TESTING -> Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Mint)
            }
            TestState.OK -> Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(18.dp).clip(CircleShape).background(Mint), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Check, null, tint = MintInk, modifier = Modifier.size(11.dp))
                }
                Spacer(Modifier.width(8.dp))
                Text(t.connectionOk, color = Color(0xFF0B7A5B), fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
            }
            TestState.FAIL -> Text(t.connectionFail, color = MaterialTheme.colorScheme.error)
            TestState.IDLE -> {}
        }

        Spacer(Modifier.height(28.dp))
        Button(
            onClick = { vm.applyServer(url.trim()); onDone() },
            enabled = url.isNotBlank(),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Color.White),
            modifier = Modifier.fillMaxWidth().height(54.dp),
        ) {
            Text(t.continueBtn, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(8.dp))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, modifier = Modifier.size(18.dp))
        }

        Spacer(Modifier.height(10.dp))
        OutlinedButton(
            onClick = {
                state = TestState.TESTING
                scope.launch { state = if (vm.testServer(url.trim())) TestState.OK else TestState.FAIL }
            },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) { Text(t.testConnection) }

        Spacer(Modifier.height(10.dp))
        OutlinedButton(
            onClick = { vm.useLocalMode(); onDone() },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) { Text(t.useLocal) }
    }
}
