package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestPublicDirectoryMatchesRepositoryLayoutAndInstalledBinary(t *testing.T) {
	original := os.Args[0]
	defer func() { os.Args[0] = original }()
	os.Args[0] = filepath.Join(os.TempDir(), "go-build-haul", "exe", "shoplist")
	if got := defaultPublicDir(); got != filepath.Join("..", "web", "dist") {
		t.Fatalf("go run cannot find the sibling web build: %s", got)
	}
	os.Args[0] = "/opt/haul/shoplist"
	if got := defaultPublicDir(); got != "/opt/haul/pb_public" {
		t.Fatalf("installed binary must use its adjacent web assets: %s", got)
	}
}

func regressionApp(t *testing.T) *pocketbase.PocketBase {
	t.Helper()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = app.ResetBootstrapState() })
	if err := core.NewMigrationsRunner(app, core.AppMigrations).Run("up"); err != nil {
		t.Fatal(err)
	}
	return app
}

func saveRegressionRecord(t *testing.T, app core.App, collection string, data map[string]any) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		t.Fatal(err)
	}
	record := core.NewRecord(col)
	for key, value := range data {
		record.Set(key, value)
	}
	if err := app.Save(record); err != nil {
		t.Fatal(err)
	}
	return record
}

func regressionList(t *testing.T, app core.App) (*core.Record, *core.Record) {
	t.Helper()
	user := saveRegressionRecord(t, app, "users", map[string]any{
		"email": newShareToken() + "@test.invalid", "password": "secret123456", "account_type": "account",
	})
	list := saveRegressionRecord(t, app, "shopping_lists", map[string]any{
		"owner": user.Id, "name": "Test list", "invite_code": newInviteCode(),
	})
	saveRegressionRecord(t, app, "list_members", map[string]any{"list": list.Id, "user": user.Id, "role": "owner"})
	return user, list
}

func regressionRouter(t *testing.T, app *pocketbase.PocketBase) http.Handler {
	t.Helper()
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	event := &core.ServeEvent{App: app, Router: router}
	if err := app.OnServe().Trigger(event); err != nil {
		t.Fatal(err)
	}
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return mux
}

func regressionRequest(handler http.Handler, method, path, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	return res
}

func TestRuntimeSettingsAreAppliedAfterBootstrap(t *testing.T) {
	t.Setenv("APP_NAME", "Regression app")
	t.Setenv("SMTP_ENABLED", "true")
	t.Setenv("SMTP_HOST", "mail.test.invalid")
	t.Setenv("SMTP_PORT", "465")
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	configureSettings(app)
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	defer app.ResetBootstrapState()
	settings := app.Settings()
	if settings.Meta.AppName != "Regression app" || !settings.Batch.Enabled || settings.Batch.MaxRequests != 200 || !settings.RateLimits.Enabled {
		t.Fatal("runtime settings were discarded during bootstrap")
	}
	if !settings.SMTP.Enabled || settings.SMTP.Host != "mail.test.invalid" || settings.SMTP.Port != 465 || !settings.SMTP.TLS {
		t.Fatal("SMTP environment settings were discarded during bootstrap")
	}
}

func TestMembersCannotMoveRecordsIntoAnotherList(t *testing.T) {
	app := regressionApp(t)
	user, list := regressionList(t, app)
	_, other := regressionList(t, app)
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	handler := regressionRouter(t, app)
	cases := []struct {
		collection string
		fields     map[string]any
		edit       string
	}{
		{"shopping_items", map[string]any{"name": "Milk", "in_list": true}, `{"note":"Two litres"}`},
		{"list_categories", map[string]any{"key": "custom", "name": "Custom"}, `{"name":"Renamed"}`},
		{"list_items", map[string]any{"category_key": "custom", "name": "Milk"}, `{"name":"Bread"}`},
		{"list_disabled_products", map[string]any{"name": "milk"}, `{"name":"bread"}`},
		{"list_disabled_categories", map[string]any{"key": "custom"}, `{"key":"other"}`},
	}
	for _, tc := range cases {
		t.Run(tc.collection, func(t *testing.T) {
			tc.fields["list"] = list.Id
			record := saveRegressionRecord(t, app, tc.collection, tc.fields)
			path := "/api/collections/" + tc.collection + "/records/" + record.Id
			res := regressionRequest(handler, http.MethodPatch, path, token, tc.edit)
			if res.Code != http.StatusOK {
				t.Fatalf("ordinary edit failed: %d %s", res.Code, res.Body.String())
			}
			res = regressionRequest(handler, http.MethodPatch, path, token, `{"list":"`+other.Id+`"}`)
			if res.Code != http.StatusNotFound {
				t.Fatalf("cross-list move was allowed: %d %s", res.Code, res.Body.String())
			}
			saved, err := app.FindRecordById(tc.collection, record.Id)
			if err != nil || saved.GetString("list") != list.Id {
				t.Fatalf("record escaped its original list: %v", err)
			}
		})
	}
}

func TestBulkTranslationAcceptsNullI18n(t *testing.T) {
	app := regressionApp(t)
	existing, err := app.FindRecordsByFilter("catalog_categories", "", "", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	complete := map[string]string{}
	for _, lang := range langNames {
		complete[lang.Code] = "Present"
	}
	for _, record := range existing {
		record.Set("i18n", complete)
		if err := app.Save(record); err != nil {
			t.Fatal(err)
		}
	}
	record := saveRegressionRecord(t, app, "catalog_categories", map[string]any{"key": "null-i18n", "name_es": "Leche", "i18n": nil})
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		translations, _ := json.Marshal(map[string]string{"en": "Milk", "ca": "Llet"})
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": chatMessage{Role: "assistant", Content: string(translations)}}}})
	}))
	defer server.Close()
	updated, total, err := bulkTranslate(app, &aiConfig{BaseURL: server.URL, Model: "test"}, "catalog_categories")
	if err != nil {
		t.Fatal(err)
	}
	if updated != 1 || total != len(existing)+1 || calls != 1 {
		t.Fatalf("unexpected translation counts: %d/%d, calls=%d", updated, total, calls)
	}
	saved, err := app.FindRecordById("catalog_categories", record.Id)
	if err != nil {
		t.Fatal(err)
	}
	current := map[string]string{}
	if err := saved.UnmarshalJSONField("i18n", &current); err != nil {
		t.Fatal(err)
	}
	if current["es"] != "Leche" || current["en"] != "Milk" {
		t.Fatalf("translations were not saved: %v", current)
	}
}

func TestPublicItemsPreserveUnicodeAndCannotEditRemovedItems(t *testing.T) {
	app := regressionApp(t)
	_, list := regressionList(t, app)
	list.Set("share_token", newShareToken())
	list.Set("share_mode", "plan")
	if err := app.Save(list); err != nil {
		t.Fatal(err)
	}
	registerRoutes(app, t.TempDir())
	handler := regressionRouter(t, app)
	name := strings.Repeat("🍎", 201)
	body, _ := json.Marshal(map[string]any{"name": name, "displayName": strings.Repeat("é", 201)})
	path := "/api/shoplist/public/" + list.GetString("share_token")
	res := regressionRequest(handler, http.MethodPost, path+"/items", "", string(body))
	if res.Code != http.StatusCreated {
		t.Fatalf("unicode item failed: %d %s", res.Code, res.Body.String())
	}
	var created struct {
		Id string `json:"id"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	record, err := app.FindRecordById("shopping_items", created.Id)
	if err != nil {
		t.Fatal(err)
	}
	if !utf8.ValidString(record.GetString("name")) || utf8.RuneCountInString(record.GetString("name")) != 200 || utf8.RuneCountInString(record.GetString("added_by")) != 200 {
		t.Fatalf("unicode names were truncated by byte count: %q", record.GetString("name"))
	}
	res = regressionRequest(handler, http.MethodDelete, path+"/items/"+record.Id, "", "")
	if res.Code != http.StatusOK {
		t.Fatalf("remove failed: %d %s", res.Code, res.Body.String())
	}
	res = regressionRequest(handler, http.MethodPost, path+"/items/"+record.Id+"/check", "", `{"checked":true}`)
	if res.Code != http.StatusNotFound {
		t.Fatalf("removed item is still editable via public link: %d %s", res.Code, res.Body.String())
	}
}

func TestAnonymousEditClearsPreviousUserAttribution(t *testing.T) {
	app := regressionApp(t)
	user, list := regressionList(t, app)
	recordHistory(app, user, "127.0.0.1", list.Id, "add", "Milk")
	recordHistory(app, nil, "127.0.0.2", list.Id, "check", "Milk")
	saved, err := app.FindRecordById("shopping_lists", list.Id)
	if err != nil {
		t.Fatal(err)
	}
	if saved.GetString("last_edited_by") != "" || saved.GetString("last_editor") != "External" {
		t.Fatalf("anonymous edit still points to previous account: %s / %s", saved.GetString("last_edited_by"), saved.GetString("last_editor"))
	}
}

func TestOptionalQuantityAndCatalogCreationIdentity(t *testing.T) {
	app := regressionApp(t)
	user, list := regressionList(t, app)
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	handler := regressionRouter(t, app)
	path := "/api/collections/shopping_items/records"
	body := `{"list":"` + list.Id + `","name":"Milk","category":"dairy","quantity":"2 cartons","catalog_source_id":"catalogmilk1234","catalog_source_kind":"custom","in_list":true}`
	response := regressionRequest(handler, http.MethodPost, path, token, body)
	if response.Code != http.StatusOK {
		t.Fatalf("create: %d %s", response.Code, response.Body.String())
	}
	var created struct {
		Id string `json:"id"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	response = regressionRequest(handler, http.MethodPatch, path+"/"+created.Id, token, `{"note":"old client edit"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("patch: %d %s", response.Code, response.Body.String())
	}
	item, err := app.FindRecordById("shopping_items", created.Id)
	if err != nil {
		t.Fatal(err)
	}
	if item.GetString("quantity") != "2 cartons" || item.GetString("catalog_source_kind") != "custom" {
		t.Fatal("old client erased optional fields")
	}
	response = regressionRequest(handler, http.MethodPatch, path+"/"+created.Id, token, `{"quantity":"`+strings.Repeat("x", 81)+`"}`)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("quantity limit: %d", response.Code)
	}
	custom := `{"id":"stablecatalog01","list":"` + list.Id + `","category_key":"dairy","name":"Milk"}`
	path = "/api/collections/list_items/records"
	response = regressionRequest(handler, http.MethodPost, path, token, custom)
	if response.Code != http.StatusOK {
		t.Fatalf("custom stable identity: %d %s", response.Code, response.Body.String())
	}
	response = regressionRequest(handler, http.MethodPost, path, token, custom)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("duplicate identity accepted: %d", response.Code)
	}
	response = regressionRequest(handler, http.MethodGet, path+"/stablecatalog01", token, "")
	if response.Code != http.StatusOK {
		t.Fatalf("lost response reconciliation: %d", response.Code)
	}
}

func TestPublicQuantityRoundTrip(t *testing.T) {
	app := regressionApp(t)
	registerRoutes(app, t.TempDir())
	_, list := regressionList(t, app)
	list.Set("share_token", "quantity-public-test")
	list.Set("share_mode", "plan")
	if err := app.Save(list); err != nil {
		t.Fatal(err)
	}
	handler := regressionRouter(t, app)
	response := regressionRequest(handler, http.MethodGet, "/api/shoplist/health", "", "")
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"supports_quantity":true`) {
		t.Fatalf("capability: %d %s", response.Code, response.Body.String())
	}
	path := "/api/shoplist/public/quantity-public-test"
	response = regressionRequest(handler, http.MethodPost, path+"/items", "", `{"name":"Milk","category":"dairy","quantity":"2 cartons","note":"Oat"}`)
	if response.Code != http.StatusCreated {
		t.Fatalf("public add: %d %s", response.Code, response.Body.String())
	}
	response = regressionRequest(handler, http.MethodGet, path, "", "")
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"quantity":"2 cartons"`) {
		t.Fatalf("snapshot: %d %s", response.Code, response.Body.String())
	}
}
