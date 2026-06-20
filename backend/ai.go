package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// The 15 supported languages (must match web/src/data/i18n.ts) and their
// English names, used to build a clear translation prompt.
var langNames = []struct{ Code, Name string }{
	{"en", "English"}, {"es", "Spanish"}, {"ca", "Catalan"}, {"zh", "Chinese (Simplified)"},
	{"hi", "Hindi"}, {"ar", "Arabic"}, {"pt", "Portuguese"}, {"bn", "Bengali"},
	{"ru", "Russian"}, {"ja", "Japanese"}, {"de", "German"}, {"fr", "French"},
	{"ko", "Korean"}, {"it", "Italian"}, {"tr", "Turkish"},
}

func langNameOf(code string) string {
	for _, l := range langNames {
		if l.Code == code {
			return l.Name
		}
	}
	return code
}

type aiConfig struct {
	Provider string
	BaseURL  string
	APIKey   string
	Model    string
	Enabled  bool
}

func readAIConfig(app core.App) (*aiConfig, error) {
	rec, err := app.FindFirstRecordByFilter("ai_config", "id != ''", nil)
	if err != nil || rec == nil {
		return nil, fmt.Errorf("the AI translation engine is not configured")
	}
	cfg := &aiConfig{
		Provider: rec.GetString("provider"),
		BaseURL:  strings.TrimRight(strings.TrimSpace(rec.GetString("base_url")), "/"),
		APIKey:   strings.TrimSpace(rec.GetString("api_key")),
		Model:    strings.TrimSpace(rec.GetString("model")),
		Enabled:  rec.GetBool("enabled"),
	}
	if !cfg.Enabled || cfg.BaseURL == "" || cfg.Model == "" {
		return nil, fmt.Errorf("the AI translation engine is disabled or incomplete")
	}
	return cfg, nil
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// chatComplete calls an OpenAI-compatible /chat/completions endpoint (works for
// OpenRouter, Ollama Cloud and a local Ollama at .../v1).
func chatComplete(cfg *aiConfig, system, user string) (string, error) {
	body, _ := json.Marshal(map[string]any{
		"model":       cfg.Model,
		"temperature": 0,
		"messages": []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
	})
	req, err := http.NewRequest(http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("AI engine returned %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	var parsed struct {
		Choices []struct {
			Message chatMessage `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil || len(parsed.Choices) == 0 {
		return "", fmt.Errorf("unexpected AI response")
	}
	return parsed.Choices[0].Message.Content, nil
}

// translateOne asks the model to translate `text` from `source` into every
// supported language (minus the source) and returns code -> translation.
func translateOne(cfg *aiConfig, text, source, kind string) (map[string]string, error) {
	if kind == "" {
		kind = "product"
	}
	targets := make([]string, 0, len(langNames))
	for _, l := range langNames {
		if l.Code != source {
			targets = append(targets, fmt.Sprintf("%s (%s)", l.Code, l.Name))
		}
	}
	system := "You are a translation engine for a grocery shopping app. Translate the given grocery " + kind +
		" name accurately and concisely. Reply with ONLY a compact JSON object mapping ISO 639-1 language codes to the translated string. No explanations, no markdown, no code fences."
	user := fmt.Sprintf("Source language: %s (%s)\nText: %q\nTranslate into these languages: %s\nReturn JSON like {\"fr\":\"...\",\"de\":\"...\"}.",
		langNameOf(source), source, text, strings.Join(targets, ", "))

	content, err := chatComplete(cfg, system, user)
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	if err := json.Unmarshal([]byte(extractJSON(content)), &out); err != nil {
		return nil, fmt.Errorf("could not parse AI translation output")
	}
	// keep only known languages, trim
	clean := map[string]string{}
	for _, l := range langNames {
		if v, ok := out[l.Code]; ok && strings.TrimSpace(v) != "" {
			clean[l.Code] = strings.TrimSpace(v)
		}
	}
	return clean, nil
}

// extractJSON returns the first {...} block from a model reply (in case it wraps
// the JSON in prose or code fences).
func extractJSON(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

// translateHandler — POST /api/shoplist/admin/translate (superuser-only).
//   - { text, source, kind } -> { translations: {lang: text} }
//   - { bulk: "catalog_items"|"catalog_categories" } -> { updated, total }
func translateHandler(e *core.RequestEvent) error {
	var body struct {
		Text   string `json:"text"`
		Source string `json:"source"`
		Kind   string `json:"kind"`
		Bulk   string `json:"bulk"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	cfg, err := readAIConfig(e.App)
	if err != nil {
		return apis.NewBadRequestError(err.Error(), nil)
	}

	if body.Bulk != "" {
		updated, total, err := bulkTranslate(e.App, cfg, body.Bulk)
		if err != nil {
			return apis.NewBadRequestError(err.Error(), err)
		}
		return e.JSON(http.StatusOK, map[string]int{"updated": updated, "total": total})
	}

	if strings.TrimSpace(body.Text) == "" {
		return apis.NewBadRequestError("Text is required.", nil)
	}
	if body.Source == "" {
		body.Source = "es"
	}
	translations, err := translateOne(cfg, strings.TrimSpace(body.Text), body.Source, body.Kind)
	if err != nil {
		return apis.NewBadRequestError(err.Error(), err)
	}
	return e.JSON(http.StatusOK, map[string]any{"translations": translations})
}

// bulkTranslate fills the i18n field of every record in the given catalog
// collection that is still missing one or more languages.
func bulkTranslate(app core.App, cfg *aiConfig, collection string) (int, int, error) {
	if collection != "catalog_items" && collection != "catalog_categories" {
		return 0, 0, fmt.Errorf("unknown collection")
	}
	kind := "product"
	if collection == "catalog_categories" {
		kind = "category"
	}
	records, err := app.FindRecordsByFilter(collection, "id != ''", "", 0, 0, nil)
	if err != nil {
		return 0, 0, err
	}
	updated := 0
	for _, rec := range records {
		source := firstNonEmpty(rec.GetString("name_es"), rec.GetString("name_ca"), rec.GetString("name_en"))
		if source == "" {
			continue
		}
		current := map[string]string{}
		_ = rec.UnmarshalJSONField("i18n", &current)
		// seed the three base names
		seedIfEmpty(current, "es", rec.GetString("name_es"))
		seedIfEmpty(current, "ca", rec.GetString("name_ca"))
		seedIfEmpty(current, "en", rec.GetString("name_en"))
		if countLangs(current) >= len(langNames) {
			continue
		}
		srcLang := "es"
		if rec.GetString("name_es") == "" {
			srcLang = firstNonEmptyLang(rec)
		}
		translated, err := translateOne(cfg, source, srcLang, kind)
		if err != nil {
			return updated, len(records), err
		}
		for code, v := range translated {
			if strings.TrimSpace(current[code]) == "" {
				current[code] = v
			}
		}
		rec.Set("i18n", current)
		if err := app.Save(rec); err == nil {
			updated++
		}
	}
	return updated, len(records), nil
}

func seedIfEmpty(m map[string]string, k, v string) {
	if strings.TrimSpace(m[k]) == "" && strings.TrimSpace(v) != "" {
		m[k] = v
	}
}
func countLangs(m map[string]string) int {
	n := 0
	for _, l := range langNames {
		if strings.TrimSpace(m[l.Code]) != "" {
			n++
		}
	}
	return n
}
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
func firstNonEmptyLang(rec *core.Record) string {
	if rec.GetString("name_ca") != "" {
		return "ca"
	}
	return "en"
}
