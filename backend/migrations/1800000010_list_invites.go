package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Pending admin invitations. When an owner/admin invites someone by email, a
// pending invite is created (instead of adding them straight away); the invitee
// sees the list name + who invited them and accepts or declines. Server-managed
// (no client rules) — read/accept/decline go through /api/shoplist/invites/*.
func init() {
	m.Register(func(app core.App) error {
		if _, err := app.FindCollectionByNameOrId("list_invites"); err == nil {
			return nil
		}
		lists, err := app.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		col := core.NewBaseCollection("list_invites")
		col.Fields.Add(
			&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.RelationField{Name: "inviter", CollectionId: users.Id, MaxSelect: 1, CascadeDelete: false},
			&core.TextField{Name: "role", Max: 20},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		col.AddIndex("idx_list_invites_unique", true, "list,user", "")
		return app.Save(col)
	}, func(app core.App) error {
		if col, err := app.FindCollectionByNameOrId("list_invites"); err == nil {
			return app.Delete(col)
		}
		return nil
	})
}
