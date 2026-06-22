package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Tracks who last edited a list (last_edited_by → users), so the admin panel can
// show the last editor. Set server-side on item edits (see last_editor.go). The
// list's `updated` timestamp is bumped at the same time so it reflects the last
// item edit, not just list-metadata changes.
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
		if lists.Fields.GetByName("last_edited_by") == nil {
			lists.Fields.Add(&core.RelationField{
				Name:          "last_edited_by",
				CollectionId:  users.Id,
				MaxSelect:     1,
				CascadeDelete: false,
			})
			return app.Save(lists)
		}
		return nil
	}, func(app core.App) error {
		lists, err := app.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		lists.Fields.RemoveByName("last_edited_by")
		return app.Save(lists)
	})
}
