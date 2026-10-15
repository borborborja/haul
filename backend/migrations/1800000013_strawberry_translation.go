package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Correct the shipped Catalan strawberry label on existing instances, preserving
// any labels that an instance administrator has already customized.
func init() {
	m.Register(func(app core.App) error {
		records, err := app.FindRecordsByFilter("catalog_items", "name_es = 'Fresas' && name_en = 'Strawberries' && name_ca = 'Sindries'", "", 0, 0)
		if err != nil {
			return err
		}
		for _, record := range records {
			record.Set("name_ca", "Maduixes")
			translations := map[string]string{}
			_ = record.UnmarshalJSONField("i18n", &translations)
			if translations != nil && translations["ca"] == "Sindries" {
				translations["ca"] = "Maduixes"
				record.Set("i18n", translations)
			}
			if err := app.Save(record); err != nil {
				return err
			}
		}
		return nil
	}, nil)
}
