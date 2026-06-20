package com.bor_devs.shoplist.ui

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import kotlinx.coroutines.launch

// Login/register wall shown when the instance requires an account (require_account).
// Register is hidden when registration is closed.
@Composable
fun AuthGateScreen(vm: MainViewModel, registrationOpen: Boolean) {
    val t = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var register by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start,
    ) {
        Text("Haul", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(4.dp))
        Text(t.accountRequired, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = email, onValueChange = { email = it }, label = { Text(t.email) }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it }, label = { Text(t.password) }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(18.dp))
        Button(
            onClick = {
                scope.launch {
                    loading = true
                    val ok = if (register) vm.register(email.trim(), password) else vm.login(email.trim(), password)
                    loading = false
                    if (!ok) Toast.makeText(context, "Error", Toast.LENGTH_SHORT).show()
                }
            },
            enabled = !loading && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (register) t.register else t.login) }
        if (registrationOpen) {
            TextButton(onClick = { register = !register }, modifier = Modifier.fillMaxWidth()) {
                Text(if (register) t.login else t.register)
            }
        }
    }
}
