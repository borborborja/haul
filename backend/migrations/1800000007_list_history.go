package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Per-list change history (audit log): who changed what, when, and from which IP
// — including external guests who edit via a public link. Powers the admin
// "last modification (incl. external)" and per-list history. Also adds a text
// `last_editor` label on lists (so external editors show, not only accounts) and
// `last_ip` on users.
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

		if _, err := app.FindCollectionByNameOrId("list_history"); err != nil {
			h := core.NewBaseCollection("list_history")
			// No client rules → readable only by superusers (admin panel) / server.
			h.Fields.Add(
				&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
				&core.RelationField{Name: "user", CollectionId: users.Id, MaxSelect: 1, CascadeDelete: false},
				&core.TextField{Name: "actor", Max: 200},
				&core.TextField{Name: "ip", Max: 60},
				&core.TextField{Name: "action", Max: 30},
				&core.TextField{Name: "detail", Max: 300},
				&core.AutodateField{Name: "created", OnCreate: true},
			)
			h.AddIndex("idx_list_history_list_created", false, "list,created", "")
			if err := app.Save(h); err != nil {
				return err
			}
		}

		if lists.Fields.GetByName("last_editor") == nil {
			lists.Fields.Add(&core.TextField{Name: "last_editor", Max: 200})
			if err := app.Save(lists); err != nil {
				return err
			}
		}
		if users.Fields.GetByName("last_ip") == nil {
			users.Fields.Add(&core.TextField{Name: "last_ip", Max: 60})
			if err := app.Save(users); err != nil {
				return err
			}
		}
		return nil
	}, func(app core.App) error {
		if h, err := app.FindCollectionByNameOrId("list_history"); err == nil {
			if err := app.Delete(h); err != nil {
				return err
			}
		}
		if lists, err := app.FindCollectionByNameOrId("shopping_lists"); err == nil {
			lists.Fields.RemoveByName("last_editor")
			_ = app.Save(lists)
		}
		if users, err := app.FindCollectionByNameOrId("users"); err == nil {
			users.Fields.RemoveByName("last_ip")
			_ = app.Save(users)
		}
		return nil
	})
}
