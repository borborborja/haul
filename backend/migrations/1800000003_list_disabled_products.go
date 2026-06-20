package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Per-list "deactivated products": products a list hides from its catalog. It is
// a row-level collection (like list_items) so concurrent members don't overwrite
// each other and PocketBase realtime + member rules apply automatically. `name`
// is the canonical product key (lowercased English/base name) shared by both clients.
func init() {
	m.Register(func(app core.App) error {
		if _, err := app.FindCollectionByNameOrId("list_disabled_products"); err == nil {
			return nil // already created
		}
		lists, err := app.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		memberRule := "@request.auth.id != '' && @collection.list_members.list ?= list && @collection.list_members.user ?= @request.auth.id"
		col := core.NewBaseCollection("list_disabled_products")
		col.ListRule = types.Pointer(memberRule)
		col.ViewRule = types.Pointer(memberRule)
		col.CreateRule = types.Pointer(memberRule)
		col.UpdateRule = types.Pointer(memberRule)
		col.DeleteRule = types.Pointer(memberRule)
		col.Fields.Add(
			&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.TextField{Name: "name", Required: true, Max: 200},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		col.AddIndex("idx_list_disabled_unique", true, "list,name", "")
		return app.Save(col)
	}, func(app core.App) error {
		if col, err := app.FindCollectionByNameOrId("list_disabled_products"); err == nil {
			return app.Delete(col)
		}
		return nil
	})
}
