package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Custom categories/items used to be synced inside the shopping_lists `data`
// JSON blob, where concurrent clients overwrote each other. The client now
// treats the per-row list_categories / list_items collections as the single
// source of truth, so this migration backfills rows from the legacy blob.
// Catalog categories/items are skipped: the blob stored the full merged map,
// but only the truly custom entries belong in the per-list collections.
func init() {
	m.Register(func(app core.App) error {
		return BackfillListCustomData(app)
	}, func(app core.App) error {
		// Additive backfill; the blob is left untouched, nothing to undo.
		return nil
	})
}

func BackfillListCustomData(app core.App) error {
	catalogKeys := map[string]bool{}
	if cats, err := app.FindAllRecords("catalog_categories"); err == nil {
		for _, c := range cats {
			catalogKeys[c.GetString("key")] = true
		}
	}
	catalogNames := map[string]bool{}
	if items, err := app.FindAllRecords("catalog_items"); err == nil {
		for _, i := range items {
			for _, f := range []string{"name_es", "name_ca", "name_en"} {
				if v := i.GetString(f); v != "" {
					catalogNames[v] = true
				}
			}
		}
	}

	listCats, err := app.FindCollectionByNameOrId("list_categories")
	if err != nil {
		return err
	}
	listItems, err := app.FindCollectionByNameOrId("list_items")
	if err != nil {
		return err
	}

	lists, err := app.FindAllRecords("shopping_lists")
	if err != nil {
		return err
	}

	for _, list := range lists {
		data := map[string]any{}
		if err := list.UnmarshalJSONField("data", &data); err != nil {
			continue
		}
		blobCats, ok := data["categories"].(map[string]any)
		if !ok {
			continue
		}

		for key, raw := range blobCats {
			cat, _ := raw.(map[string]any)

			if !catalogKeys[key] {
				existing, _ := app.FindFirstRecordByFilter(
					"list_categories",
					"list = {:list} && key = {:key}",
					dbx.Params{"list": list.Id, "key": key},
				)
				if existing == nil {
					rec := core.NewRecord(listCats)
					rec.Set("list", list.Id)
					rec.Set("key", key)
					rec.Set("name", key)
					if cat != nil {
						if icon, ok := cat["icon"].(string); ok {
							rec.Set("icon", icon)
						}
					}
					if err := app.Save(rec); err != nil {
						app.Logger().Warn("backfill: could not save list category", "list", list.Id, "key", key, "error", err)
					}
				}
			}

			if cat == nil {
				continue
			}
			items, _ := cat["items"].([]any)
			for _, it := range items {
				name := blobItemName(it)
				if name == "" || catalogNames[name] {
					continue
				}
				existing, _ := app.FindFirstRecordByFilter(
					"list_items",
					"list = {:list} && category_key = {:key} && name = {:name}",
					dbx.Params{"list": list.Id, "key": key, "name": name},
				)
				if existing == nil {
					rec := core.NewRecord(listItems)
					rec.Set("list", list.Id)
					rec.Set("category_key", key)
					rec.Set("name", name)
					if err := app.Save(rec); err != nil {
						app.Logger().Warn("backfill: could not save list item", "list", list.Id, "name", name, "error", err)
					}
				}
			}
		}
	}
	return nil
}

// blobItemName resolves an item from the legacy blob, which stored either a
// plain string or a localized {es,ca,en} object.
func blobItemName(it any) string {
	switch v := it.(type) {
	case string:
		return v
	case map[string]any:
		for _, k := range []string{"es", "ca", "en"} {
			if s, ok := v[k].(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}
