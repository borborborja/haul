package main

import (
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	migrations "shoplist/migrations"
)

func TestInviteCodesAreRandomAndUnambiguous(t *testing.T) {
	first := newInviteCode()
	second := newInviteCode()
	if len(first) != 10 || len(second) != 10 {
		t.Fatalf("expected 10 character invite codes, got %q and %q", first, second)
	}
	if first == second {
		t.Fatal("expected independently generated invite codes")
	}
}

func TestV2SchemaAppliesToEmptyDatabase(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("bootstrap failed: %v", err)
	}
	defer app.ResetBootstrapState()
	if err := core.NewMigrationsRunner(app, core.AppMigrations).Run("up"); err != nil {
		t.Fatalf("app migrations failed: %v", err)
	}

	for _, name := range []string{
		"users", "service_accounts", "shopping_lists", "list_members", "shopping_items",
		"catalog_categories", "catalog_items", "list_categories", "list_items", "app_config", "bring_links",
	} {
		if _, err := app.FindCollectionByNameOrId(name); err != nil {
			t.Errorf("missing collection %s: %v", name, err)
		}
	}

	lists, err := app.FindCollectionByNameOrId("shopping_lists")
	if err != nil {
		t.Fatal(err)
	}
	if lists.CreateRule != nil {
		t.Fatal("shopping_lists must not allow direct client creation")
	}
	items, err := app.FindCollectionByNameOrId("shopping_items")
	if err != nil {
		t.Fatal(err)
	}
	if items.CreateRule == nil || items.UpdateRule == nil || items.DeleteRule == nil {
		t.Fatal("shopping_items must have explicit member/service access rules")
	}
	config, err := app.FindCollectionByNameOrId("app_config")
	if err != nil {
		t.Fatal(err)
	}
	if config.CreateRule != nil || config.UpdateRule != nil || config.DeleteRule != nil {
		t.Fatal("app_config mutations must be restricted to superusers")
	}
}

func TestBackfillListCustomDataExtractsOnlyCustomEntries(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("bootstrap failed: %v", err)
	}
	defer app.ResetBootstrapState()
	if err := core.NewMigrationsRunner(app, core.AppMigrations).Run("up"); err != nil {
		t.Fatalf("app migrations failed: %v", err)
	}

	// Seed a catalog category + item that must be skipped by the backfill.
	catCol, _ := app.FindCollectionByNameOrId("catalog_categories")
	catalogCat := core.NewRecord(catCol)
	catalogCat.Set("key", "fruit")
	catalogCat.Set("icon", "🍎")
	if err := app.Save(catalogCat); err != nil {
		t.Fatal(err)
	}
	itemCol, _ := app.FindCollectionByNameOrId("catalog_items")
	catalogItem := core.NewRecord(itemCol)
	catalogItem.Set("category", catalogCat.Id)
	catalogItem.Set("name_es", "Manzana")
	catalogItem.Set("name_ca", "Poma")
	catalogItem.Set("name_en", "Apple")
	if err := app.Save(catalogItem); err != nil {
		t.Fatal(err)
	}

	// A user + list whose legacy data blob mixes catalog and custom entries.
	usersCol, _ := app.FindCollectionByNameOrId("users")
	user := core.NewRecord(usersCol)
	user.SetEmail("backfill@test.invalid")
	user.SetPassword("secret123456")
	user.Set("account_type", "account")
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	listsCol, _ := app.FindCollectionByNameOrId("shopping_lists")
	list := core.NewRecord(listsCol)
	list.Set("owner", user.Id)
	list.Set("name", "Test")
	list.Set("invite_code", newInviteCode())
	list.Set("data", map[string]any{
		"listName": "Casa",
		"categories": map[string]any{
			"fruit": map[string]any{
				"icon": "🍎",
				"items": []any{
					map[string]any{"es": "Manzana", "ca": "Poma", "en": "Apple"}, // catalog: skip
					"Pitahaya", // custom item in a catalog category
				},
			},
			"panaderia": map[string]any{ // fully custom category
				"icon":  "🥖",
				"items": []any{"Hogaza"},
			},
		},
	})
	if err := app.Save(list); err != nil {
		t.Fatal(err)
	}

	if err := migrations.BackfillListCustomData(app); err != nil {
		t.Fatalf("backfill failed: %v", err)
	}

	if _, err := app.FindFirstRecordByFilter("list_categories", "list = {:l} && key = 'panaderia'", dbx.Params{"l": list.Id}); err != nil {
		t.Error("expected custom category 'panaderia' to be backfilled")
	}
	if rec, _ := app.FindFirstRecordByFilter("list_categories", "list = {:l} && key = 'fruit'", dbx.Params{"l": list.Id}); rec != nil {
		t.Error("catalog category 'fruit' must not be backfilled")
	}
	if _, err := app.FindFirstRecordByFilter("list_items", "list = {:l} && name = 'Pitahaya'", dbx.Params{"l": list.Id}); err != nil {
		t.Error("expected custom item 'Pitahaya' to be backfilled")
	}
	if _, err := app.FindFirstRecordByFilter("list_items", "list = {:l} && name = 'Hogaza'", dbx.Params{"l": list.Id}); err != nil {
		t.Error("expected custom item 'Hogaza' to be backfilled")
	}
	if rec, _ := app.FindFirstRecordByFilter("list_items", "list = {:l} && name = 'Manzana'", dbx.Params{"l": list.Id}); rec != nil {
		t.Error("catalog item 'Manzana' must not be backfilled")
	}

	// Idempotent: a second run must not duplicate rows.
	if err := migrations.BackfillListCustomData(app); err != nil {
		t.Fatalf("second backfill failed: %v", err)
	}
	count, err := app.CountRecords("list_items")
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("expected 2 backfilled list items after re-run, got %d", count)
	}
}
