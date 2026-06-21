package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Adds public-link sharing to shopping_lists: an opaque `share_token` plus a
// `share_mode` ("" = not shared, "read" | "shop" | "plan"). Both are managed
// only by server actions (see share.go + the OnRecordUpdateRequest guard in
// main.go) and are hidden from the regular record API so the token never leaks
// through normal member reads.
func init() {
	m.Register(func(app core.App) error {
		lists, err := app.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		if lists.Fields.GetByName("share_token") == nil {
			lists.Fields.Add(&core.TextField{Name: "share_token", Hidden: true, Max: 40})
		}
		if lists.Fields.GetByName("share_mode") == nil {
			lists.Fields.Add(&core.TextField{Name: "share_mode", Hidden: true, Max: 10})
		}
		// Non-unique: many lists share the empty default; uniqueness of real
		// tokens is guaranteed by random generation (22 chars).
		lists.AddIndex("idx_shopping_lists_share_token", false, "share_token", "")
		return app.Save(lists)
	}, func(app core.App) error {
		lists, err := app.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		lists.RemoveIndex("idx_shopping_lists_share_token")
		lists.Fields.RemoveByName("share_token")
		lists.Fields.RemoveByName("share_mode")
		return app.Save(lists)
	})
}
