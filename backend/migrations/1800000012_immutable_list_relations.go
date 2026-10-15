package migrations

import (
	"strings"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Update rules are evaluated against the existing record. Without an explicit
// guard, a member can move their record into a list they cannot access by
// submitting a different list relation in a PATCH request.
func init() {
	collections := []string{"shopping_items", "list_categories", "list_items", "list_disabled_products", "list_disabled_categories"}
	const suffix = " && @request.body.list:changed = false"
	m.Register(func(app core.App) error {
		for _, name := range collections {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				return err
			}
			if col.UpdateRule != nil && !strings.HasSuffix(*col.UpdateRule, suffix) {
				col.UpdateRule = types.Pointer("(" + *col.UpdateRule + ")" + suffix)
				if err := app.Save(col); err != nil {
					return err
				}
			}
		}
		return nil
	}, func(app core.App) error {
		for _, name := range collections {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				return err
			}
			if col.UpdateRule != nil && strings.HasSuffix(*col.UpdateRule, suffix) {
				rule := strings.TrimSuffix(*col.UpdateRule, suffix)
				col.UpdateRule = types.Pointer(strings.TrimSuffix(strings.TrimPrefix(rule, "("), ")"))
				if err := app.Save(col); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
