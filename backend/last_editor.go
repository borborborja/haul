package main

import (
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// actorName is the human display name for per-item attribution: the caller's
// display name, else the email local-part, else "Guest"; "External" for
// anonymous / service callers.
func actorName(auth *core.Record) string {
	if auth != nil && auth.Collection() != nil && auth.Collection().Name == "users" {
		if name := strings.TrimSpace(auth.GetString("display_name")); name != "" {
			return name
		}
		if email := auth.GetString("email"); email != "" {
			return strings.SplitN(email, "@", 2)[0]
		}
		return "Guest"
	}
	return "External"
}

// authUserId returns the requesting users-collection account id, or "" for
// service accounts / anonymous (public-link) callers.
func authUserId(auth *core.Record) string {
	if auth != nil && auth.Collection() != nil && auth.Collection().Name == "users" {
		return auth.Id
	}
	return ""
}

// actorLabel returns (userId, humanLabel) for a request's caller. Accounts show
// their email, guests their display name, and anonymous public-link editors show
// "External".
func actorLabel(auth *core.Record) (string, string) {
	if auth != nil && auth.Collection() != nil && auth.Collection().Name == "users" {
		email := auth.GetString("email")
		name := auth.GetString("display_name")
		if auth.GetString("account_type") == "account" && email != "" {
			return auth.Id, email
		}
		if name != "" {
			return auth.Id, name
		}
		return auth.Id, "Guest"
	}
	return "", "External"
}

// recordHistory appends a change to a list's audit log (who/what/when/IP),
// stamps the list's last editor (incl. external), and records the user's last IP.
// Best-effort: never blocks the originating request.
func recordHistory(app core.App, auth *core.Record, ip, listId, action, detail string) {
	if listId == "" {
		return
	}
	userId, label := actorLabel(auth)

	if col, err := app.FindCollectionByNameOrId("list_history"); err == nil {
		h := core.NewRecord(col)
		h.Set("list", listId)
		if userId != "" {
			h.Set("user", userId)
		}
		h.Set("actor", label)
		h.Set("ip", ip)
		h.Set("action", action)
		h.Set("detail", detail)
		_ = app.Save(h)
	}

	if list, err := app.FindRecordById("shopping_lists", listId); err == nil {
		if userId != "" {
			list.Set("last_edited_by", userId)
		}
		list.Set("last_editor", label)
		_ = app.Save(list) // bumps `updated`
	}

	if userId != "" && ip != "" {
		if u, err := app.FindRecordById("users", userId); err == nil {
			u.Set("last_ip", ip)
			_ = app.Save(u)
		}
	}
}

// registerLastEditor logs list changes made through the authenticated item API
// (app users). Public-link edits are logged directly in the share handlers.
func registerLastEditor(app core.App) {
	app.OnRecordCreateRequest("shopping_items").BindFunc(func(e *core.RecordRequestEvent) error {
		// Attribute the item to its creator (set before save).
		e.Record.Set("added_by", actorName(e.Auth))
		if err := e.Next(); err != nil {
			return err
		}
		recordHistory(e.App, e.Auth, e.RealIP(), e.Record.GetString("list"), "add", e.Record.GetString("name"))
		return nil
	})
	app.OnRecordUpdateRequest("shopping_items").BindFunc(func(e *core.RecordRequestEvent) error {
		nowChecked := e.Record.GetBool("checked")
		wasChecked := e.Record.Original().GetBool("checked")
		if nowChecked && !wasChecked {
			e.Record.Set("checked_by", actorName(e.Auth)) // who bought it
		} else if !nowChecked && wasChecked {
			e.Record.Set("checked_by", "")
		}
		if err := e.Next(); err != nil {
			return err
		}
		action := "edit"
		if nowChecked {
			action = "check"
		}
		recordHistory(e.App, e.Auth, e.RealIP(), e.Record.GetString("list"), action, e.Record.GetString("name"))
		return nil
	})
	app.OnRecordDeleteRequest("shopping_items").BindFunc(func(e *core.RecordRequestEvent) error {
		listId := e.Record.GetString("list")
		name := e.Record.GetString("name")
		if err := e.Next(); err != nil {
			return err
		}
		recordHistory(e.App, e.Auth, e.RealIP(), listId, "remove", name)
		return nil
	})
}
