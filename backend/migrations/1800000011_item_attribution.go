package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Per-item attribution: who added an item (added_by) and who bought/checked it
// (checked_by). Plain text names (app members → their name; public-link viewers
// → the name they enter), shown on the item card.
func init() {
	m.Register(func(app core.App) error {
		items, err := app.FindCollectionByNameOrId("shopping_items")
		if err != nil {
			return err
		}
		changed := false
		if items.Fields.GetByName("added_by") == nil {
			items.Fields.Add(&core.TextField{Name: "added_by", Max: 200})
			changed = true
		}
		if items.Fields.GetByName("checked_by") == nil {
			items.Fields.Add(&core.TextField{Name: "checked_by", Max: 200})
			changed = true
		}
		if changed {
			return app.Save(items)
		}
		return nil
	}, func(app core.App) error {
		items, err := app.FindCollectionByNameOrId("shopping_items")
		if err != nil {
			return err
		}
		items.Fields.RemoveByName("added_by")
		items.Fields.RemoveByName("checked_by")
		return app.Save(items)
	})
}
