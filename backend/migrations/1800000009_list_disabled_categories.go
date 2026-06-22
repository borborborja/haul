package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Per-list "deactivated categories": default catalog categories a list hides from
// its planner. Row-level (like list_disabled_products) so concurrent members
// don't clobber each other and realtime + member rules apply. `key` is the
// category key shared by both clients (e.g. "fruit").
func init() {
	m.Register(func(app core.App) error {
		if _, err := app.FindCollectionByNameOrId("list_disabled_categories"); err == nil {
			return nil
		}
		lists, err := app.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		memberRule := "@request.auth.id != '' && @collection.list_members.list ?= list && @collection.list_members.user ?= @request.auth.id"
		col := core.NewBaseCollection("list_disabled_categories")
		col.ListRule = types.Pointer(memberRule)
		col.ViewRule = types.Pointer(memberRule)
		col.CreateRule = types.Pointer(memberRule)
		col.UpdateRule = types.Pointer(memberRule)
		col.DeleteRule = types.Pointer(memberRule)
		col.Fields.Add(
			&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.TextField{Name: "key", Required: true, Max: 80},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		col.AddIndex("idx_list_disabled_cats_unique", true, "list,key", "")
		return app.Save(col)
	}, func(app core.App) error {
		if col, err := app.FindCollectionByNameOrId("list_disabled_categories"); err == nil {
			return app.Delete(col)
		}
		return nil
	})
}
