package main

import (
	"net/http"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// memberRole returns the caller's list_members role ("owner"|"editor") for a
// list, or "" if they are not a member. (Guests live in list_guests, not here.)
func memberRole(app core.App, listId, userId string) string {
	if userId == "" {
		return ""
	}
	m, _ := app.FindFirstRecordByFilter("list_members",
		"list = {:l} && user = {:u}", dbx.Params{"l": listId, "u": userId})
	if m == nil {
		return ""
	}
	return m.GetString("role")
}

// avatarURL builds the relative file URL for a user's avatar (empty if none).
// Clients prefix their own origin.
func avatarURL(u *core.Record) string {
	f := u.GetString("avatar")
	if f == "" {
		return ""
	}
	return "/api/files/users/" + u.Id + "/" + f
}

// touchGuest bumps the caller's list_guests.last_active_at (if they are a guest
// of that list). Called from the public write endpoints so guests show as
// recently active in the members menu. No-op for anonymous callers / members.
func touchGuest(e *core.RequestEvent, listId string) {
	if e.Auth == nil {
		return
	}
	g, _ := e.App.FindFirstRecordByFilter("list_guests",
		"list = {:l} && user = {:u}", dbx.Params{"l": listId, "u": e.Auth.Id})
	if g != nil {
		_ = e.App.Save(g) // OnUpdate autodate refreshes last_active_at
	}
}

// joinByToken resolves a share/admin link opened while signed in. An admin_token
// makes the caller a full member (role "editor"); a share_token records them as
// a guest (list_guests) whose abilities follow the list's share_mode. Returns
// the role so the client knows whether to use the authenticated API (admin) or
// the public token endpoints (guest).
func joinByToken(e *core.RequestEvent) error {
	if e.Auth == nil {
		return apis.NewUnauthorizedError("Sign in required.", nil)
	}
	token := strings.TrimSpace(e.Request.PathValue("token"))
	if token == "" {
		return apis.NewNotFoundError("Link not found.", nil)
	}

	// Admin link first.
	if list, _ := e.App.FindFirstRecordByFilter("shopping_lists",
		"admin_token = {:t} && admin_token != ''", dbx.Params{"t": token}); list != nil {
		if memberRole(e.App, list.Id, e.Auth.Id) == "" {
			col, err := e.App.FindCollectionByNameOrId("list_members")
			if err != nil {
				return err
			}
			rec := core.NewRecord(col)
			rec.Set("list", list.Id)
			rec.Set("user", e.Auth.Id)
			rec.Set("role", "editor")
			if err := e.App.Save(rec); err != nil {
				return apis.NewBadRequestError("Could not join the list.", err)
			}
		}
		dropGuest(e.App, list.Id, e.Auth.Id)
		return e.JSON(http.StatusOK, map[string]any{"listId": list.Id, "name": list.GetString("name"), "role": "admin"})
	}

	// Share link → guest.
	list, _ := e.App.FindFirstRecordByFilter("shopping_lists",
		"share_token = {:t} && share_mode != ''", dbx.Params{"t": token})
	if list == nil {
		return apis.NewNotFoundError("This shared link is no longer available.", nil)
	}
	// A full member opening a share link stays a member.
	if memberRole(e.App, list.Id, e.Auth.Id) != "" {
		return e.JSON(http.StatusOK, map[string]any{"listId": list.Id, "name": list.GetString("name"), "role": "admin", "mode": list.GetString("share_mode")})
	}
	g, _ := e.App.FindFirstRecordByFilter("list_guests",
		"list = {:l} && user = {:u}", dbx.Params{"l": list.Id, "u": e.Auth.Id})
	if g == nil {
		col, err := e.App.FindCollectionByNameOrId("list_guests")
		if err != nil {
			return err
		}
		g = core.NewRecord(col)
		g.Set("list", list.Id)
		g.Set("user", e.Auth.Id)
		if err := e.App.Save(g); err != nil {
			return apis.NewBadRequestError("Could not open the shared list.", err)
		}
	}
	return e.JSON(http.StatusOK, map[string]any{"listId": list.Id, "name": list.GetString("name"), "role": "guest", "mode": list.GetString("share_mode")})
}

func dropGuest(app core.App, listId, userId string) {
	if g, _ := app.FindFirstRecordByFilter("list_guests",
		"list = {:l} && user = {:u}", dbx.Params{"l": listId, "u": userId}); g != nil {
		_ = app.Delete(g)
	}
}

// addAdmin grants a known account editor (admin) access by email. Owner/admin
// only. If the email has no account, returns {noAccount:true} so the client can
// offer the admin link instead (no email is sent).
func addAdmin(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}
	if list.GetString("owner") != e.Auth.Id && memberRole(e.App, listId, e.Auth.Id) != "editor" {
		return apis.NewForbiddenError("Only an admin can add admins.", nil)
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", nil)
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" {
		return apis.NewBadRequestError("An email is required.", nil)
	}

	u, _ := e.App.FindAuthRecordByEmail("users", email)
	if u == nil {
		return e.JSON(http.StatusOK, map[string]any{"noAccount": true})
	}
	// Already a member → nothing to do.
	if existing, _ := e.App.FindFirstRecordByFilter("list_members",
		"list = {:l} && user = {:u}", dbx.Params{"l": listId, "u": u.Id}); existing != nil {
		return e.JSON(http.StatusOK, map[string]any{"alreadyMember": true})
	}
	// Create (or refresh) a pending invite — the invitee accepts/declines.
	inv, _ := e.App.FindFirstRecordByFilter("list_invites",
		"list = {:l} && user = {:u}", dbx.Params{"l": listId, "u": u.Id})
	if inv == nil {
		col, err := e.App.FindCollectionByNameOrId("list_invites")
		if err != nil {
			return err
		}
		inv = core.NewRecord(col)
		inv.Set("list", listId)
		inv.Set("user", u.Id)
	}
	inv.Set("inviter", e.Auth.Id)
	inv.Set("role", "editor")
	if err := e.App.Save(inv); err != nil {
		return apis.NewBadRequestError("Could not send the invitation.", err)
	}
	return e.JSON(http.StatusOK, map[string]any{"invited": true})
}

// listInvites returns the caller's pending list invitations with the list name
// and inviter's display name, for the accept/decline prompt.
func listInvites(e *core.RequestEvent) error {
	invites, _ := e.App.FindRecordsByFilter("list_invites", "user = {:u}", "-created", 0, 0, dbx.Params{"u": e.Auth.Id})
	type out struct {
		Id       string `json:"id"`
		ListId   string `json:"listId"`
		ListName string `json:"listName"`
		Inviter  string `json:"inviter"`
		Role     string `json:"role"`
	}
	res := make([]out, 0, len(invites))
	for _, inv := range invites {
		o := out{Id: inv.Id, ListId: inv.GetString("list"), Role: inv.GetString("role")}
		if l, err := e.App.FindRecordById("shopping_lists", inv.GetString("list")); err == nil {
			o.ListName = l.GetString("name")
		}
		if iv := inv.GetString("inviter"); iv != "" {
			if u, err := e.App.FindRecordById("users", iv); err == nil {
				if u.GetString("account_type") == "account" && u.GetString("email") != "" {
					o.Inviter = u.GetString("email")
				} else {
					o.Inviter = u.GetString("display_name")
				}
			}
		}
		res = append(res, o)
	}
	return e.JSON(http.StatusOK, res)
}

// acceptInvite turns a pending invite into membership (role editor) for the caller.
func acceptInvite(e *core.RequestEvent) error {
	inv, err := e.App.FindRecordById("list_invites", e.Request.PathValue("id"))
	if err != nil {
		return apis.NewNotFoundError("Invitation not found.", nil)
	}
	if inv.GetString("user") != e.Auth.Id {
		return apis.NewForbiddenError("This invitation is not for you.", nil)
	}
	listId := inv.GetString("list")
	role := inv.GetString("role")
	if role == "" {
		role = "editor"
	}
	if memberRole(e.App, listId, e.Auth.Id) == "" {
		col, err := e.App.FindCollectionByNameOrId("list_members")
		if err != nil {
			return err
		}
		mrec := core.NewRecord(col)
		mrec.Set("list", listId)
		mrec.Set("user", e.Auth.Id)
		mrec.Set("role", role)
		if err := e.App.Save(mrec); err != nil {
			return apis.NewBadRequestError("Could not join the list.", err)
		}
	}
	dropGuest(e.App, listId, e.Auth.Id)
	_ = e.App.Delete(inv)
	name := ""
	if l, err := e.App.FindRecordById("shopping_lists", listId); err == nil {
		name = l.GetString("name")
	}
	return e.JSON(http.StatusOK, map[string]any{"listId": listId, "name": name})
}

// declineInvite removes a pending invite for the caller.
func declineInvite(e *core.RequestEvent) error {
	inv, err := e.App.FindRecordById("list_invites", e.Request.PathValue("id"))
	if err != nil {
		return apis.NewNotFoundError("Invitation not found.", nil)
	}
	if inv.GetString("user") != e.Auth.Id {
		return apis.NewForbiddenError("This invitation is not for you.", nil)
	}
	_ = e.App.Delete(inv)
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}

// adminLink returns (creating if needed) the list's admin invite token. The
// client builds the link as {origin}/s/<token>. Owner/admin only.
func adminLink(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}
	if list.GetString("owner") != e.Auth.Id && memberRole(e.App, listId, e.Auth.Id) != "editor" {
		return apis.NewForbiddenError("Only an admin can create an admin link.", nil)
	}
	token := list.GetString("admin_token")
	if token == "" {
		token = newShareToken()
		list.Set("admin_token", token)
		if err := e.App.Save(list); err != nil {
			return apis.NewBadRequestError("Could not create the admin link.", err)
		}
	}
	return e.JSON(http.StatusOK, map[string]string{"token": token})
}

type memberOut struct {
	UserId       string `json:"userId"`
	Name         string `json:"name"`
	Role         string `json:"role"` // owner | admin | guest
	AvatarURL    string `json:"avatarUrl"`
	Color        string `json:"color"`
	LastActiveAt string `json:"lastActiveAt"`
}

// listMembers returns the list's admins (list_members) and guests (list_guests)
// with their profile + last-active, so the owner/admin can see who has access.
// Any member may view; guests cannot.
func listMembers(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	if memberRole(e.App, listId, e.Auth.Id) == "" {
		return apis.NewForbiddenError("You are not a member of this list.", nil)
	}

	out := []memberOut{}

	members, _ := e.App.FindRecordsByFilter("list_members", "list = {:l}", "", 0, 0, dbx.Params{"l": listId})
	for _, m := range members {
		u, err := e.App.FindRecordById("users", m.GetString("user"))
		if err != nil {
			continue
		}
		role := "admin"
		if m.GetString("role") == "owner" {
			role = "owner"
		}
		out = append(out, memberOut{
			UserId:       u.Id,
			Name:         u.GetString("display_name"),
			Role:         role,
			AvatarURL:    avatarURL(u),
			Color:        u.GetString("avatar_color"),
			LastActiveAt: u.GetDateTime("last_active_at").String(),
		})
	}

	guests, _ := e.App.FindRecordsByFilter("list_guests", "list = {:l}", "-last_active_at", 0, 0, dbx.Params{"l": listId})
	for _, g := range guests {
		u, err := e.App.FindRecordById("users", g.GetString("user"))
		if err != nil {
			continue
		}
		out = append(out, memberOut{
			UserId:       u.Id,
			Name:         u.GetString("display_name"),
			Role:         "guest",
			AvatarURL:    avatarURL(u),
			Color:        u.GetString("avatar_color"),
			LastActiveAt: g.GetDateTime("last_active_at").String(),
		})
	}

	return e.JSON(http.StatusOK, out)
}

// removeMember revokes a member or guest from a list. Owner/admin only; the
// owner cannot be removed.
func removeMember(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	targetId := e.Request.PathValue("userId")
	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}
	if list.GetString("owner") != e.Auth.Id && memberRole(e.App, listId, e.Auth.Id) != "editor" {
		return apis.NewForbiddenError("Only an admin can remove members.", nil)
	}
	if targetId == list.GetString("owner") {
		return apis.NewBadRequestError("The owner cannot be removed.", nil)
	}

	if m, _ := e.App.FindFirstRecordByFilter("list_members",
		"list = {:l} && user = {:u}", dbx.Params{"l": listId, "u": targetId}); m != nil {
		_ = e.App.Delete(m)
	}
	dropGuest(e.App, listId, targetId)
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}
