package main

import (
	"net/http"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

// shareAlphabet is URL-safe and avoids ambiguous characters; 22 chars give a
// non-guessable public token (36^22 keyspace) for shareable list links.
const shareAlphabet = "abcdefghijkmnpqrstuvwxyz23456789"

func newShareToken() string {
	return security.RandomStringWithAlphabet(22, shareAlphabet)
}

// validShareMode reports whether m is one of the three public access levels.
func validShareMode(m string) bool {
	return m == "read" || m == "shop" || m == "plan"
}

// manageShare creates or updates a list's public share link. Owner-only. It
// generates a token on first share (or when rotate=true) and sets the access
// mode. Returns the token + mode so the client can build the public URL.
func manageShare(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}
	if list.GetString("owner") != e.Auth.Id {
		return apis.NewForbiddenError("Only the list owner can manage the share link.", nil)
	}

	var body struct {
		Mode   string `json:"mode"`
		Rotate bool   `json:"rotate"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	mode := strings.TrimSpace(body.Mode)
	if !validShareMode(mode) {
		return apis.NewBadRequestError("Invalid share mode.", nil)
	}

	token := list.GetString("share_token")
	if token == "" || body.Rotate {
		token = newShareToken()
	}
	list.Set("share_token", token)
	list.Set("share_mode", mode)
	if err := e.App.Save(list); err != nil {
		return apis.NewBadRequestError("Could not update the share link.", err)
	}

	return e.JSON(http.StatusOK, map[string]any{"token": token, "mode": mode})
}

// getShare returns the current public-link state for a list. Owner-only. Used
// by the in-app share controls to show the existing link/mode on open.
func getShare(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}
	if list.GetString("owner") != e.Auth.Id {
		return apis.NewForbiddenError("Only the list owner can view the share link.", nil)
	}
	return e.JSON(http.StatusOK, map[string]any{
		"token": list.GetString("share_token"),
		"mode":  list.GetString("share_mode"),
	})
}

// revokeShare disables a list's public link. Owner-only. The token is cleared
// so any previously shared URL stops working immediately.
func revokeShare(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}
	if list.GetString("owner") != e.Auth.Id {
		return apis.NewForbiddenError("Only the list owner can manage the share link.", nil)
	}

	list.Set("share_token", "")
	list.Set("share_mode", "")
	if err := e.App.Save(list); err != nil {
		return apis.NewBadRequestError("Could not revoke the share link.", err)
	}
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}

// findSharedList resolves a public token to its list, enforcing that sharing is
// currently enabled (a non-empty share_mode).
func findSharedList(e *core.RequestEvent) (*core.Record, error) {
	token := strings.TrimSpace(e.Request.PathValue("token"))
	if token == "" {
		return nil, apis.NewNotFoundError("Link not found.", nil)
	}
	list, err := e.App.FindFirstRecordByFilter(
		"shopping_lists",
		"share_token = {:token} && share_mode != ''",
		dbx.Params{"token": token},
	)
	if err != nil || list == nil {
		return nil, apis.NewNotFoundError("This shared link is no longer available.", nil)
	}
	return list, nil
}

// publicSnapshot returns the read-only payload for a shared list: its name, the
// current access mode, the in-list items and the metadata of the categories
// they belong to. No authentication required — access is gated by the token.
func publicSnapshot(e *core.RequestEvent) error {
	list, err := findSharedList(e)
	if err != nil {
		return err
	}

	items, err := e.App.FindRecordsByFilter(
		"shopping_items",
		"list = {:list} && in_list = true",
		"-created", 0, 0,
		dbx.Params{"list": list.Id},
	)
	if err != nil {
		return apis.NewBadRequestError("Could not load the list.", err)
	}

	type outItem struct {
		Id       string `json:"id"`
		Name     string `json:"name"`
		Category string `json:"category"`
		Checked  bool   `json:"checked"`
		Note     string `json:"note"`
	}
	outItems := make([]outItem, 0, len(items))
	keys := map[string]bool{}
	for _, it := range items {
		cat := it.GetString("category")
		keys[cat] = true
		outItems = append(outItems, outItem{
			Id:       it.Id,
			Name:     it.GetString("name"),
			Category: cat,
			Checked:  it.GetBool("checked"),
			Note:     it.GetString("note"),
		})
	}

	type cat struct {
		Key  string            `json:"key"`
		Icon string            `json:"icon"`
		Name map[string]string `json:"name"`
	}
	cats := make([]cat, 0, len(keys))
	for key := range keys {
		if key == "" {
			continue
		}
		cats = append(cats, resolveCategory(e.App, list.Id, key))
	}

	return e.JSON(http.StatusOK, map[string]any{
		"list":       map[string]string{"name": list.GetString("name")},
		"mode":       list.GetString("share_mode"),
		"items":      outItems,
		"categories": cats,
	})
}

// resolveCategory builds display metadata (icon + localized names) for a
// category key, preferring a list-custom category over the global catalog and
// falling back to the raw key.
func resolveCategory(app core.App, listId, key string) struct {
	Key  string            `json:"key"`
	Icon string            `json:"icon"`
	Name map[string]string `json:"name"`
} {
	out := struct {
		Key  string            `json:"key"`
		Icon string            `json:"icon"`
		Name map[string]string `json:"name"`
	}{Key: key, Name: map[string]string{"es": key, "ca": key, "en": key}}

	if rec, _ := app.FindFirstRecordByFilter("list_categories", "list = {:list} && key = {:key}",
		dbx.Params{"list": listId, "key": key}); rec != nil {
		out.Icon = rec.GetString("icon")
		name := rec.GetString("name")
		if name != "" {
			out.Name = map[string]string{"es": name, "ca": name, "en": name}
		}
		return out
	}
	if rec, _ := app.FindFirstRecordByFilter("catalog_categories", "key = {:key}",
		dbx.Params{"key": key}); rec != nil {
		out.Icon = rec.GetString("icon")
		out.Name = map[string]string{
			"es": orKey(rec.GetString("name_es"), key),
			"ca": orKey(rec.GetString("name_ca"), key),
			"en": orKey(rec.GetString("name_en"), key),
		}
	}
	return out
}

func orKey(v, key string) string {
	if strings.TrimSpace(v) == "" {
		return key
	}
	return v
}

// publicCheckItem toggles the checked state of an item via a shared link.
// Allowed in "shop" and "plan" modes.
func publicCheckItem(e *core.RequestEvent) error {
	list, err := findSharedList(e)
	if err != nil {
		return err
	}
	mode := list.GetString("share_mode")
	if mode != "shop" && mode != "plan" {
		return apis.NewForbiddenError("This link is read-only.", nil)
	}

	item, err := e.App.FindRecordById("shopping_items", e.Request.PathValue("itemId"))
	if err != nil || item.GetString("list") != list.Id {
		return apis.NewNotFoundError("Item not found.", nil)
	}

	var body struct {
		Checked bool `json:"checked"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	item.Set("checked", body.Checked)
	if err := e.App.Save(item); err != nil {
		return apis.NewBadRequestError("Could not update the item.", err)
	}
	touchGuest(e, list.Id)
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}

// publicAddItem adds a free-text item to a shared list. Allowed in "plan" mode.
func publicAddItem(e *core.RequestEvent) error {
	list, err := findSharedList(e)
	if err != nil {
		return err
	}
	if list.GetString("share_mode") != "plan" {
		return apis.NewForbiddenError("This link cannot add items.", nil)
	}

	var body struct {
		Name     string `json:"name"`
		Category string `json:"category"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return apis.NewBadRequestError("A name is required.", nil)
	}
	if len(name) > 200 {
		name = name[:200]
	}

	collection, err := e.App.FindCollectionByNameOrId("shopping_items")
	if err != nil {
		return err
	}
	item := core.NewRecord(collection)
	item.Set("list", list.Id)
	item.Set("name", name)
	item.Set("category", strings.TrimSpace(body.Category))
	item.Set("checked", false)
	item.Set("in_list", true)
	item.Set("source", "share")
	if err := e.App.Save(item); err != nil {
		return apis.NewBadRequestError("Could not add the item.", err)
	}
	touchGuest(e, list.Id)
	return e.JSON(http.StatusCreated, map[string]string{"id": item.Id})
}

// publicRemoveItem drops an item from a shared list's buy set (in_list=false).
// Allowed in "plan" mode. The record is kept so the owner's planner state is
// not destroyed by anonymous editors.
func publicRemoveItem(e *core.RequestEvent) error {
	list, err := findSharedList(e)
	if err != nil {
		return err
	}
	if list.GetString("share_mode") != "plan" {
		return apis.NewForbiddenError("This link cannot remove items.", nil)
	}

	item, err := e.App.FindRecordById("shopping_items", e.Request.PathValue("itemId"))
	if err != nil || item.GetString("list") != list.Id {
		return apis.NewNotFoundError("Item not found.", nil)
	}
	item.Set("in_list", false)
	item.Set("checked", false)
	if err := e.App.Save(item); err != nil {
		return apis.NewBadRequestError("Could not remove the item.", err)
	}
	touchGuest(e, list.Id)
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}
