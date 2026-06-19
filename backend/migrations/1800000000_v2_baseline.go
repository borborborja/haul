package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		self := "id = @request.auth.id"
		users.ListRule = types.Pointer(self)
		users.ViewRule = types.Pointer(self)
		users.CreateRule = types.Pointer("@request.body.account_type = 'account' && @request.body.email != ''")
		users.UpdateRule = types.Pointer(self)
		users.DeleteRule = nil
		users.AuthRule = types.Pointer("account_type = 'account' || account_type = 'guest'")
		users.Fields.Add(
			&core.TextField{Name: "display_name", Max: 100},
			&core.SelectField{Name: "account_type", Values: []string{"guest", "account"}, Required: true, MaxSelect: 1},
			&core.TextField{Name: "current_list", Max: 20},
			&core.AutodateField{Name: "last_active_at", OnUpdate: true},
		)
		if err := app.Save(users); err != nil {
			return err
		}

		serviceAccounts := core.NewAuthCollection("service_accounts")
		serviceAccounts.Fields.Add(
			&core.SelectField{Name: "role", Values: []string{"bring"}, Required: true, MaxSelect: 1},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		serviceAccounts.AuthRule = types.Pointer("role = 'bring'")
		if err := app.Save(serviceAccounts); err != nil {
			return err
		}

		lists := core.NewBaseCollection("shopping_lists")
		memberRule := "@request.auth.id != '' && @collection.list_members.list ?= id && @collection.list_members.user ?= @request.auth.id"
		ownerRule := "@request.auth.id != '' && owner = @request.auth.id"
		lists.CreateRule = nil
		lists.DeleteRule = types.Pointer(ownerRule)
		lists.Fields.Add(
			&core.RelationField{Name: "owner", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.TextField{Name: "name", Required: true, Max: 120},
			&core.TextField{Name: "invite_code", Required: true, Hidden: true, Min: 10, Max: 10},
			&core.JSONField{Name: "data", MaxSize: 262144},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		lists.AddIndex("idx_shopping_lists_invite_code", true, "invite_code", "")
		if err := app.Save(lists); err != nil {
			return err
		}

		members := core.NewBaseCollection("list_members")
		memberSelf := "@request.auth.id != '' && user = @request.auth.id"
		members.ListRule = types.Pointer(memberSelf)
		members.ViewRule = types.Pointer(memberSelf)
		members.CreateRule = nil
		members.UpdateRule = nil
		members.DeleteRule = nil
		members.Fields.Add(
			&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.SelectField{Name: "role", Values: []string{"owner", "editor"}, Required: true, MaxSelect: 1},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		members.AddIndex("idx_list_members_unique", true, "list,user", "")
		if err := app.Save(members); err != nil {
			return err
		}

		lists.ListRule = types.Pointer(memberRule)
		lists.ViewRule = types.Pointer(memberRule)
		lists.UpdateRule = types.Pointer(memberRule)
		if err := app.Save(lists); err != nil {
			return err
		}

		itemRule := "(@request.auth.id != '' && @collection.list_members.list ?= list && @collection.list_members.user ?= @request.auth.id) || (@request.auth.collectionName = 'service_accounts' && @request.auth.role = 'bring')"
		items := core.NewBaseCollection("shopping_items")
		items.ListRule = types.Pointer(itemRule)
		items.ViewRule = types.Pointer(itemRule)
		items.CreateRule = types.Pointer(itemRule)
		items.UpdateRule = types.Pointer(itemRule)
		items.DeleteRule = types.Pointer(itemRule)
		items.Fields.Add(
			&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.TextField{Name: "name", Required: true, Max: 200},
			&core.TextField{Name: "category", Max: 80},
			&core.BoolField{Name: "checked"},
			&core.BoolField{Name: "in_list"},
			&core.TextField{Name: "note", Max: 1000},
			&core.TextField{Name: "source", Max: 30},
			&core.TextField{Name: "external_id", Max: 200},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		items.AddIndex("idx_shopping_items_list_updated", false, "list,updated", "")
		if err := app.Save(items); err != nil {
			return err
		}

		if err := createCatalog(app); err != nil {
			return err
		}
		if err := createListCustomData(app, lists); err != nil {
			return err
		}
		if err := createAppConfig(app); err != nil {
			return err
		}
		return createBringLinks(app, lists)
	}, func(app core.App) error {
		for _, name := range []string{"bring_links", "app_config", "list_items", "list_categories", "catalog_items", "catalog_categories", "shopping_items", "list_members", "shopping_lists", "service_accounts"} {
			collection, err := app.FindCollectionByNameOrId(name)
			if err == nil {
				if err := app.Delete(collection); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func createCatalog(app core.App) error {
	publicRead := types.Pointer("")
	categories := core.NewBaseCollection("catalog_categories")
	categories.ListRule = publicRead
	categories.ViewRule = publicRead
	categories.Fields.Add(
		&core.TextField{Name: "key", Required: true, Max: 80},
		&core.TextField{Name: "icon", Max: 20},
		&core.TextField{Name: "color", Max: 30},
		&core.TextField{Name: "name_es", Max: 200},
		&core.TextField{Name: "name_ca", Max: 200},
		&core.TextField{Name: "name_en", Max: 200},
		&core.NumberField{Name: "order"},
		&core.BoolField{Name: "hidden"},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	categories.AddIndex("idx_catalog_categories_key", true, "key", "")
	if err := app.Save(categories); err != nil {
		return err
	}

	items := core.NewBaseCollection("catalog_items")
	items.ListRule = publicRead
	items.ViewRule = publicRead
	items.Fields.Add(
		&core.RelationField{Name: "category", CollectionId: categories.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.TextField{Name: "name_es", Required: true, Max: 200},
		&core.TextField{Name: "name_ca", Required: true, Max: 200},
		&core.TextField{Name: "name_en", Required: true, Max: 200},
		&core.BoolField{Name: "hidden"},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	return app.Save(items)
}

func createListCustomData(app core.App, lists *core.Collection) error {
	memberRule := "@request.auth.id != '' && @collection.list_members.list ?= list && @collection.list_members.user ?= @request.auth.id"

	categories := core.NewBaseCollection("list_categories")
	categories.ListRule = types.Pointer(memberRule)
	categories.ViewRule = types.Pointer(memberRule)
	categories.CreateRule = types.Pointer(memberRule)
	categories.UpdateRule = types.Pointer(memberRule)
	categories.DeleteRule = types.Pointer(memberRule)
	categories.Fields.Add(
		&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.TextField{Name: "key", Required: true, Max: 80},
		&core.TextField{Name: "icon", Max: 20},
		&core.TextField{Name: "name", Max: 200},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	categories.AddIndex("idx_list_categories_unique", true, "list,key", "")
	if err := app.Save(categories); err != nil {
		return err
	}

	items := core.NewBaseCollection("list_items")
	items.ListRule = types.Pointer(memberRule)
	items.ViewRule = types.Pointer(memberRule)
	items.CreateRule = types.Pointer(memberRule)
	items.UpdateRule = types.Pointer(memberRule)
	items.DeleteRule = types.Pointer(memberRule)
	items.Fields.Add(
		&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.TextField{Name: "category_key", Required: true, Max: 80},
		&core.TextField{Name: "name", Required: true, Max: 200},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	items.AddIndex("idx_list_items_unique", true, "list,category_key,name", "")
	return app.Save(items)
}

func createAppConfig(app core.App) error {
	config := core.NewBaseCollection("app_config")
	config.ListRule = types.Pointer("")
	config.ViewRule = types.Pointer("")
	config.Fields.Add(
		&core.TextField{Name: "key", Required: true, Max: 100},
		&core.JSONField{Name: "value", MaxSize: 65536},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	config.AddIndex("idx_app_config_key", true, "key", "")
	return app.Save(config)
}

func createBringLinks(app core.App, lists *core.Collection) error {
	links := core.NewBaseCollection("bring_links")
	serviceRule := types.Pointer("@request.auth.collectionName = 'service_accounts' && @request.auth.role = 'bring'")
	links.ListRule = serviceRule
	links.ViewRule = serviceRule
	links.UpdateRule = serviceRule
	links.Fields.Add(
		&core.RelationField{Name: "list", CollectionId: lists.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.TextField{Name: "bring_list_uuid", Required: true, Max: 200},
		&core.TextField{Name: "bring_list_name", Max: 200},
		&core.BoolField{Name: "enabled"},
		&core.SelectField{Name: "status", Values: []string{"idle", "syncing", "ok", "error"}, MaxSelect: 1},
		&core.TextField{Name: "last_error", Max: 2000},
		&core.JSONField{Name: "snapshot", MaxSize: 1048576},
		&core.AutodateField{Name: "last_synced_at", OnUpdate: true},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	links.AddIndex("idx_bring_links_unique", true, "list,bring_list_uuid", "")
	return app.Save(links)
}
