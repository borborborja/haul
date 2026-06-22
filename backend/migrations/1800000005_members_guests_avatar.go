package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Link-based sharing redesign:
//   - list_guests: people who opened a share link in the app. They are tracked
//     (so admins see them) but are NOT list_members, so they get no authenticated
//     write access — their edits go through the mode-gated public token endpoints.
//   - shopping_lists.admin_token: opaque token for the "add admin" invite link.
//   - users.avatar (file) + users.avatar_color: profile picture / fallback color.
// All managed by server actions; client API access stays locked down.
func init() {
	m.Register(func(app core.App) error {
		lists, err := app.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		// list_guests — server-only access (nil rules); the members endpoint reads
		// it via the DAO. Cascade-delete with the list and the user.
		if _, err := app.FindCollectionByNameOrId("list_guests"); err != nil {
			guests := core.NewBaseCollection("list_guests")
			guests.Fields.Add(
				&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
				&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
				&core.AutodateField{Name: "last_active_at", OnCreate: true, OnUpdate: true},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)
			guests.AddIndex("idx_list_guests_unique", true, "list,user", "")
			if err := app.Save(guests); err != nil {
				return err
			}
		}

		// admin_token on shopping_lists (hidden; server-managed like share_token).
		if lists.Fields.GetByName("admin_token") == nil {
			lists.Fields.Add(&core.TextField{Name: "admin_token", Hidden: true, Max: 40})
			lists.AddIndex("idx_shopping_lists_admin_token", false, "admin_token", "")
			if err := app.Save(lists); err != nil {
				return err
			}
		}

		// avatar (file) + avatar_color on users.
		changed := false
		if users.Fields.GetByName("avatar") == nil {
			users.Fields.Add(&core.FileField{
				Name:      "avatar",
				MaxSelect: 1,
				MaxSize:   5 * 1024 * 1024,
				MimeTypes: []string{"image/jpeg", "image/png", "image/webp", "image/gif"},
			})
			changed = true
		}
		if users.Fields.GetByName("avatar_color") == nil {
			users.Fields.Add(&core.TextField{Name: "avatar_color", Max: 20})
			changed = true
		}
		if changed {
			if err := app.Save(users); err != nil {
				return err
			}
		}
		return nil
	}, func(app core.App) error {
		if guests, err := app.FindCollectionByNameOrId("list_guests"); err == nil {
			if err := app.Delete(guests); err != nil {
				return err
			}
		}
		if lists, err := app.FindCollectionByNameOrId("shopping_lists"); err == nil {
			lists.RemoveIndex("idx_shopping_lists_admin_token")
			lists.Fields.RemoveByName("admin_token")
			if err := app.Save(lists); err != nil {
				return err
			}
		}
		if users, err := app.FindCollectionByNameOrId("users"); err == nil {
			users.Fields.RemoveByName("avatar")
			users.Fields.RemoveByName("avatar_color")
			if err := app.Save(users); err != nil {
				return err
			}
		}
		return nil
	})
}
