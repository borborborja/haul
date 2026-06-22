package migrations

import (
	_ "embed"
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

//go:embed catalog_seed.json
var catalogSeedJSON []byte

type seedItem struct {
	NameES string `json:"name_es"`
	NameCA string `json:"name_ca"`
	NameEN string `json:"name_en"`
}
type seedCategory struct {
	Key    string     `json:"key"`
	Icon   string     `json:"icon"`
	Color  string     `json:"color"`
	Order  int        `json:"order"`
	NameES string     `json:"name_es"`
	NameCA string     `json:"name_ca"`
	NameEN string     `json:"name_en"`
	Items  []seedItem `json:"items"`
}

// Seeds the COMMON catalog (catalog_categories + catalog_items) from the bundled
// defaults the first time it is empty, so the admin panel has content to manage
// and every instance ships the same baseline catalog. Idempotent: it does
// nothing once any category exists, so admin edits are never overwritten. The
// es/ca/en names are also copied into i18n so "translate missing" fills the rest.
func init() {
	m.Register(func(app core.App) error {
		count, err := app.CountRecords("catalog_categories")
		if err != nil {
			return err
		}
		if count > 0 {
			return nil // already populated (or admin-managed) — leave it alone
		}

		var seed struct {
			Categories []seedCategory `json:"categories"`
		}
		if err := json.Unmarshal(catalogSeedJSON, &seed); err != nil {
			return err
		}

		catCol, err := app.FindCollectionByNameOrId("catalog_categories")
		if err != nil {
			return err
		}
		itemCol, err := app.FindCollectionByNameOrId("catalog_items")
		if err != nil {
			return err
		}

		for _, c := range seed.Categories {
			cat := core.NewRecord(catCol)
			cat.Set("key", c.Key)
			cat.Set("icon", c.Icon)
			cat.Set("color", c.Color)
			cat.Set("order", c.Order)
			cat.Set("name_es", c.NameES)
			cat.Set("name_ca", c.NameCA)
			cat.Set("name_en", c.NameEN)
			cat.Set("hidden", false)
			cat.Set("i18n", map[string]string{"es": c.NameES, "ca": c.NameCA, "en": c.NameEN})
			if err := app.Save(cat); err != nil {
				return err
			}
			for _, it := range c.Items {
				item := core.NewRecord(itemCol)
				item.Set("category", cat.Id)
				item.Set("name_es", it.NameES)
				item.Set("name_ca", it.NameCA)
				item.Set("name_en", it.NameEN)
				item.Set("hidden", false)
				item.Set("i18n", map[string]string{"es": it.NameES, "ca": it.NameCA, "en": it.NameEN})
				if err := app.Save(item); err != nil {
					return err
				}
			}
		}
		return nil
	}, func(app core.App) error {
		// Down: remove only seeded default categories (by key) + their items cascade.
		var seed struct {
			Categories []seedCategory `json:"categories"`
		}
		if err := json.Unmarshal(catalogSeedJSON, &seed); err != nil {
			return err
		}
		for _, c := range seed.Categories {
			if rec, _ := app.FindFirstRecordByFilter("catalog_categories", "key = {:k}", map[string]any{"k": c.Key}); rec != nil {
				if err := app.Delete(rec); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
