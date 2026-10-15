package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Optional shopping quantity and stable catalog provenance. Existing clients can
// omit these fields without clearing values saved by newer clients.
func init() {
	m.Register(func(app core.App) error {
		items, err := app.FindCollectionByNameOrId("shopping_items")
		if err != nil {
			return err
		}
		for name, max := range map[string]int{"quantity": 80, "catalog_source_id": 200, "catalog_source_kind": 20, "catalog_source_category": 80} {
			if items.Fields.GetByName(name) == nil {
				items.Fields.Add(&core.TextField{Name: name, Max: max})
			}
		}
		return app.Save(items)
	}, func(app core.App) error {
		items, err := app.FindCollectionByNameOrId("shopping_items")
		if err != nil {
			return err
		}
		for _, name := range []string{"quantity", "catalog_source_id", "catalog_source_kind", "catalog_source_category"} {
			items.Fields.RemoveByName(name)
		}
		return app.Save(items)
	})
}
