package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Adds 15-language support to the catalog (an additive JSON `i18n` field on
// catalog_categories and catalog_items, keeping name_es/ca/en authoritative for
// backward compatibility) and a superuser-only `ai_config` collection holding
// the translation engine credentials (NOT in the public app_config).
func init() {
	m.Register(func(app core.App) error {
		// i18n field on the catalog collections
		for _, name := range []string{"catalog_categories", "catalog_items"} {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				return err
			}
			if col.Fields.GetByName("i18n") == nil {
				col.Fields.Add(&core.JSONField{Name: "i18n", MaxSize: 65536})
				if err := app.Save(col); err != nil {
					return err
				}
			}
		}

		// ai_config — no API rules => superuser-only access. Server reads it via
		// the DAO (bypasses rules); the admin UI reads/writes it as a superuser.
		if _, err := app.FindCollectionByNameOrId("ai_config"); err != nil {
			cfg := core.NewBaseCollection("ai_config")
			cfg.Fields.Add(
				&core.TextField{Name: "provider", Max: 40},
				&core.TextField{Name: "base_url", Max: 300},
				&core.TextField{Name: "api_key", Max: 400},
				&core.TextField{Name: "model", Max: 120},
				&core.BoolField{Name: "enabled"},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)
			if err := app.Save(cfg); err != nil {
				return err
			}
		}
		return nil
	}, func(app core.App) error {
		if cfg, err := app.FindCollectionByNameOrId("ai_config"); err == nil {
			if err := app.Delete(cfg); err != nil {
				return err
			}
		}
		for _, name := range []string{"catalog_categories", "catalog_items"} {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			col.Fields.RemoveByName("i18n")
			if err := app.Save(col); err != nil {
				return err
			}
		}
		return nil
	})
}
