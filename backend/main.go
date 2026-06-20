package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/osutils"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/security"

	_ "shoplist/migrations"
)

const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// defaultAdminEmail is the instance-admin identity used when the admin is
// configured from the environment (ADMIN_PASSWORD) with password-only login.
const defaultAdminEmail = "admin@haul.local"

func main() {
	app := pocketbase.New()

	var publicDir string
	app.RootCmd.PersistentFlags().StringVar(&publicDir, "publicDir", defaultPublicDir(), "directory containing the web app")
	app.RootCmd.ParseFlags(os.Args[1:])

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: true})
	configureSettings(app)
	protectAccountTypes(app)
	purgeOrphanGuests(app)
	syncEnvAdmin(app)
	syncEnvConfig(app)
	registerRoutes(app, publicDir)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func configureSettings(app core.App) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		settings := e.App.Settings()
		settings.RateLimits.Enabled = true
		settings.Meta.AppName = envOr("APP_NAME", "ShoppingList")

		// Batch API: lets clients clear/delete many items in one request
		settings.Batch.Enabled = true
		settings.Batch.MaxRequests = 200
		settings.Batch.Timeout = 10

		if os.Getenv("SMTP_ENABLED") == "true" {
			port, err := strconv.Atoi(os.Getenv("SMTP_PORT"))
			if err != nil || port == 0 {
				port = 587
			}
			settings.SMTP.Enabled = true
			settings.SMTP.Host = os.Getenv("SMTP_HOST")
			settings.SMTP.Port = port
			settings.SMTP.Username = os.Getenv("SMTP_USER")
			settings.SMTP.Password = os.Getenv("SMTP_PASSWORD")
			settings.SMTP.TLS = port == 465
			settings.Meta.SenderName = envOr("SMTP_SENDER_NAME", "ShoppingList")
			settings.Meta.SenderAddress = os.Getenv("SMTP_SENDER_ADDRESS")
		}

		return e.Next()
	})
}

func registerRoutes(app core.App, publicDir string) {
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			e.Router.GET("/api/shoplist/health", func(e *core.RequestEvent) error {
				return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
			})

			e.Router.GET("/api/shoplist/setup", setupStatus)
			e.Router.POST("/api/shoplist/setup", runSetup)
			e.Router.POST("/api/shoplist/guests", createGuest)
			e.Router.POST("/api/shoplist/account/claim", claimAccount).Bind(apis.RequireAuth("users"))
			e.Router.POST("/api/shoplist/lists", createList).Bind(apis.RequireAuth("users"))
			e.Router.POST("/api/shoplist/lists/join", joinList).Bind(apis.RequireAuth("users"))
			e.Router.POST("/api/shoplist/lists/{id}/rotate-code", rotateCode).Bind(apis.RequireAuth("users"))
			e.Router.GET("/api/shoplist/lists/{id}/presence", listPresence).Bind(apis.RequireAuth("users"))

				// Admin-only AI catalog translation (superuser session required).
				e.Router.POST("/api/shoplist/admin/translate", translateHandler).Bind(apis.RequireSuperuserAuth())

			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), true))
			}
			return e.Next()
		},
		Priority: 999,
	})
}

func protectAccountTypes(app core.App) {
	app.OnRecordUpdateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Record.GetString("account_type") != e.Record.Original().GetString("account_type") {
			return apis.NewForbiddenError("Account type cannot be changed directly.", nil)
		}
		return e.Next()
	})
	// Block new account sign-ups when registration is closed. Superusers (the
	// admin Users tab) are exempt so they can always create accounts.
	app.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		isSuperuser := e.Auth != nil && e.Auth.Collection().Name == core.CollectionNameSuperusers
		if !isSuperuser && e.Record.GetString("account_type") == "account" && !configBool(e.App, "registration_open", true) {
			return apis.NewForbiddenError("New account registration is closed on this instance.", nil)
		}
		return e.Next()
	})
	app.OnRecordUpdateRequest("shopping_lists").BindFunc(func(e *core.RecordRequestEvent) error {
		original := e.Record.Original()
		if e.Record.GetString("owner") != original.GetString("owner") ||
			e.Record.GetString("invite_code") != original.GetString("invite_code") {
			return apis.NewForbiddenError("List ownership and invitation codes can only be changed by server actions.", nil)
		}
		return e.Next()
	})
}

// realSuperuserCount counts superusers excluding PocketBase's internal installer
// placeholder (DefaultInstallerEmail), which exists until the first real
// superuser is created.
func realSuperuserCount(app core.App) (int64, error) {
	return app.CountRecords(
		core.CollectionNameSuperusers,
		dbx.NewExp("email != {:installer}", dbx.Params{"installer": core.DefaultInstallerEmail}),
	)
}

// setupStatus reports whether the instance still needs its first-run wizard,
// i.e. no real superuser has been created yet.
func setupStatus(e *core.RequestEvent) error {
	total, err := realSuperuserCount(e.App)
	if err != nil {
		return err
	}
	// When ADMIN_PASSWORD is configured the instance admin comes from the
	// environment (password-only login), so the web wizard is skipped and the
	// admin email is published for the login form to authenticate against.
	return e.JSON(http.StatusOK, map[string]any{
		"needsSetup": total == 0,
		"envAdmin":   os.Getenv("ADMIN_PASSWORD") != "",
		"adminEmail": envOr("ADMIN_EMAIL", defaultAdminEmail),
		"lockedKeys": lockedConfigKeys(),
	})
}

// envConfigKeys maps env vars to app_config keys. When an env var is set it is
// seeded into app_config on every boot (env wins) and the cfg key is reported
// as locked so the admin panel renders it read-only.
var envConfigKeys = []struct {
	Env  string
	Cfg  string
	Bool bool
}{
	{"SERVER_NAME", "server_name", false},
	{"ENABLE_WEB_APP", "enable_web_app", true},
	{"ENABLE_USERNAMES", "enable_usernames", true},
	{"REQUIRE_ACCOUNT", "require_account", true},
	{"REGISTRATION_OPEN", "registration_open", true},
}

func lockedConfigKeys() []string {
	out := []string{}
	for _, k := range envConfigKeys {
		if os.Getenv(k.Env) != "" {
			out = append(out, k.Cfg)
		}
	}
	return out
}

// syncEnvConfig seeds app_config from env on every boot, so .env prevails over
// admin edits. Unset env vars are left to admin control. Runs on OnServe (after
// migrations have applied and collections are cached).
func syncEnvConfig(app core.App) {
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		for _, k := range envConfigKeys {
			v := os.Getenv(k.Env)
			if v == "" {
				continue
			}
			if k.Bool {
				v = boolStr(strings.EqualFold(v, "true") || v == "1")
			}
			if err := setConfig(e.App, k.Cfg, v); err != nil {
				log.Printf("env config: could not set %s: %v", k.Cfg, err)
			}
		}
		return e.Next()
	})
}

// configBool reads a boolean app_config value (stored as a JSON string),
// defaulting when absent.
func configBool(app core.App, key string, def bool) bool {
	rec, _ := app.FindFirstRecordByFilter("app_config", "key = {:key}", dbx.Params{"key": key})
	if rec == nil {
		return def
	}
	v := strings.Trim(strings.TrimSpace(rec.GetString("value")), "\"")
	if v == "" {
		return def
	}
	return strings.EqualFold(v, "true") || v == "1"
}

// syncEnvAdmin upserts the instance-admin superuser from ADMIN_PASSWORD /
// ADMIN_EMAIL on every boot, so the environment is the source of truth and
// editing .env + restarting resets or rotates the admin password. It is a
// no-op when ADMIN_PASSWORD is unset (the first-run web wizard is used instead).
func syncEnvAdmin(app core.App) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}

		password := os.Getenv("ADMIN_PASSWORD")
		if password == "" {
			return nil
		}
		if len(password) < 8 {
			log.Printf("env admin: ADMIN_PASSWORD must be at least 8 characters; skipping admin sync")
			return nil
		}
		email := envOr("ADMIN_EMAIL", defaultAdminEmail)

		record, _ := e.App.FindAuthRecordByEmail(core.CollectionNameSuperusers, email)
		if record == nil {
			superusers, err := e.App.FindCollectionByNameOrId(core.CollectionNameSuperusers)
			if err != nil {
				log.Printf("env admin: could not load superusers collection: %v", err)
				return nil
			}
			record = core.NewRecord(superusers)
			record.SetEmail(email)
		}
		record.SetPassword(password)
		if err := e.App.Save(record); err != nil {
			log.Printf("env admin: could not save admin %q: %v", email, err)
			return nil
		}
		return nil
	})
}

// runSetup performs the first-run wizard: it creates the initial superuser and
// stores the main instance settings. It only succeeds while no superuser exists,
// so it cannot be used to escalate privileges once the instance is configured.
func runSetup(e *core.RequestEvent) error {
	var body struct {
		Email              string `json:"email"`
		Password           string `json:"password"`
		ServerName      string `json:"serverName"`
		EnableWebApp    bool   `json:"enableWebApp"`
		EnableUsernames bool   `json:"enableUsernames"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" {
		return apis.NewBadRequestError("An email address is required.", nil)
	}
	if len(body.Password) < 8 {
		return apis.NewBadRequestError("The password must be at least 8 characters long.", nil)
	}

	err := e.App.RunInTransaction(func(tx core.App) error {
		total, err := realSuperuserCount(tx)
		if err != nil {
			return err
		}
		if total > 0 {
			return apis.NewForbiddenError("This instance has already been set up.", nil)
		}

		superusers, err := tx.FindCollectionByNameOrId(core.CollectionNameSuperusers)
		if err != nil {
			return err
		}
		admin := core.NewRecord(superusers)
		admin.SetEmail(body.Email)
		admin.SetPassword(body.Password)
		if err := tx.Save(admin); err != nil {
			return err
		}

		if err := setConfig(tx, "server_name", strings.TrimSpace(body.ServerName)); err != nil {
			return err
		}
		if err := setConfig(tx, "enable_web_app", boolStr(body.EnableWebApp)); err != nil {
			return err
		}
		return setConfig(tx, "enable_usernames", boolStr(body.EnableUsernames))
	})
	if err != nil {
		if apiErr, ok := err.(*router.ApiError); ok {
			return apiErr
		}
		return apis.NewBadRequestError("Could not complete the setup.", err)
	}

	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}

// setConfig upserts a single app_config key/value pair.
func setConfig(tx core.App, key, value string) error {
	record, _ := tx.FindFirstRecordByFilter("app_config", "key = {:key}", dbx.Params{"key": key})
	if record == nil {
		collection, err := tx.FindCollectionByNameOrId("app_config")
		if err != nil {
			return err
		}
		record = core.NewRecord(collection)
		record.Set("key", key)
	}
	record.Set("value", value)
	return tx.Save(record)
}

func boolStr(v bool) string {
	if v {
		return "true"
	}
	return "false"
}

// claimAccount upgrades the current guest session into a permanent account
// in place, preserving the user id (and therefore its list memberships and
// owned lists). It only adds portability (email + password) so the user can
// recover their lists on another device.
func claimAccount(e *core.RequestEvent) error {
	if e.Auth.GetString("account_type") == "account" {
		return apis.NewBadRequestError("This session is already an account.", nil)
	}
	if !configBool(e.App, "registration_open", true) {
		return apis.NewForbiddenError("New account registration is closed on this instance.", nil)
	}

	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Email == "" {
		return apis.NewBadRequestError("An email address is required.", nil)
	}
	if len(body.Password) < 8 {
		return apis.NewBadRequestError("The password must be at least 8 characters long.", nil)
	}

	// Force login (no identity merge in v1) if the email already belongs to someone else.
	if existing, _ := e.App.FindAuthRecordByEmail("users", body.Email); existing != nil && existing.Id != e.Auth.Id {
		return apis.NewApiError(http.StatusConflict, "That email already has an account. Please sign in instead.", nil)
	}

	record, err := e.App.FindRecordById("users", e.Auth.Id)
	if err != nil {
		return apis.NewNotFoundError("Account not found.", err)
	}
	record.SetEmail(body.Email)
	record.SetPassword(body.Password)
	record.Set("account_type", "account")
	// Internal Save bypasses the OnRecordUpdateRequest("users") guard on purpose:
	// this server action is the only sanctioned way to promote guest -> account.
	if err := e.App.Save(record); err != nil {
		return apis.NewBadRequestError("Could not save the account.", err)
	}

	return apis.RecordAuthResponse(e, record, "", nil)
}

// purgeOrphanGuests deletes guest accounts that have been inactive for more
// than 90 days and that do not belong to any list, on every boot.
func purgeOrphanGuests(app core.App) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}

		cutoff := time.Now().AddDate(0, 0, -90).UTC().Format("2006-01-02 15:04:05.000Z")
		guests, err := e.App.FindRecordsByFilter(
			"users",
			// NB: an empty datetime string sorts before any real value, so it must be
			// excluded from the first comparison; never-active guests fall back to `created`.
			"account_type = 'guest' && ((last_active_at != '' && last_active_at < {:cutoff}) || (last_active_at = '' && created < {:cutoff}))",
			"", 0, 0,
			dbx.Params{"cutoff": cutoff},
		)
		if err != nil {
			log.Printf("guest purge: query failed: %v", err)
			return nil
		}

		removed := 0
		for _, guest := range guests {
			memberships, err := e.App.CountRecords("list_members", dbx.NewExp("user = {:id}", dbx.Params{"id": guest.Id}))
			if err != nil || memberships > 0 {
				continue
			}
			if err := e.App.Delete(guest); err == nil {
				removed++
			}
		}
		if removed > 0 {
			log.Printf("guest purge: removed %d orphan guest(s)", removed)
		}
		return nil
	})
}

func createGuest(e *core.RequestEvent) error {
	if configBool(e.App, "require_account", false) {
		return apis.NewForbiddenError("An account is required on this instance.", nil)
	}
	collection, err := e.App.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}

	guest := core.NewRecord(collection)
	guest.SetEmail("guest-" + security.RandomString(24) + "@guest.invalid")
	guest.SetPassword(security.RandomString(32))
	guest.Set("display_name", "Guest")
	guest.Set("account_type", "guest")
	if err := e.App.Save(guest); err != nil {
		return apis.NewBadRequestError("Could not create a guest session.", err)
	}
	return apis.RecordAuthResponse(e, guest, "", nil)
}

func createList(e *core.RequestEvent) error {
	// Any authenticated user (including guests) can create a shared list. The
	// account is only needed to recover lists on another device.
	var body struct {
		Name string `json:"name"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" {
		body.Name = "Shopping list"
	}

	var list *core.Record
	code := newInviteCode()
	err := e.App.RunInTransaction(func(tx core.App) error {
		collection, err := tx.FindCollectionByNameOrId("shopping_lists")
		if err != nil {
			return err
		}
		list = core.NewRecord(collection)
		list.Set("owner", e.Auth.Id)
		list.Set("name", body.Name)
		list.Set("invite_code", code)
		list.Set("data", map[string]any{})
		if err := tx.Save(list); err != nil {
			return err
		}

		members, err := tx.FindCollectionByNameOrId("list_members")
		if err != nil {
			return err
		}
		member := core.NewRecord(members)
		member.Set("list", list.Id)
		member.Set("user", e.Auth.Id)
		member.Set("role", "owner")
		return tx.Save(member)
	})
	if err != nil {
		return apis.NewBadRequestError("Could not create the list.", err)
	}

	return e.JSON(http.StatusCreated, map[string]any{"id": list.Id, "name": list.GetString("name"), "inviteCode": code})
}

func joinList(e *core.RequestEvent) error {
	var body struct {
		Code string `json:"code"`
	}
	if err := e.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Invalid request.", err)
	}
	code := strings.ToUpper(strings.TrimSpace(body.Code))
	if code == "" {
		return apis.NewBadRequestError("An invitation code is required.", nil)
	}

	list, err := e.App.FindFirstRecordByFilter("shopping_lists", "invite_code = {:code}", dbx.Params{"code": code})
	if err != nil {
		return apis.NewNotFoundError("Invitation code not found.", nil)
	}

	existing, _ := e.App.FindFirstRecordByFilter(
		"list_members",
		"list = {:list} && user = {:user}",
		dbx.Params{"list": list.Id, "user": e.Auth.Id},
	)
	if existing == nil {
		members, err := e.App.FindCollectionByNameOrId("list_members")
		if err != nil {
			return err
		}
		member := core.NewRecord(members)
		member.Set("list", list.Id)
		member.Set("user", e.Auth.Id)
		member.Set("role", "editor")
		if err := e.App.Save(member); err != nil {
			return apis.NewBadRequestError("Could not join the list.", err)
		}
	}

	return e.JSON(http.StatusOK, map[string]any{"id": list.Id, "name": list.GetString("name"), "inviteCode": code})
}

func rotateCode(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")
	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}
	if list.GetString("owner") != e.Auth.Id {
		return apis.NewForbiddenError("Only the list owner can rotate the invitation code.", nil)
	}

	code := newInviteCode()
	list.Set("invite_code", code)
	if err := e.App.Save(list); err != nil {
		return apis.NewBadRequestError("Could not rotate the invitation code.", err)
	}
	return e.JSON(http.StatusOK, map[string]string{"inviteCode": code})
}

// listPresence returns the members recently active on a list. The users
// collection rules only let a user list themselves, so presence of OTHER
// members must go through this route, which checks membership and exposes
// only id, display name and last activity.
func listPresence(e *core.RequestEvent) error {
	listId := e.Request.PathValue("id")

	membership, _ := e.App.FindFirstRecordByFilter(
		"list_members",
		"list = {:list} && user = {:user}",
		dbx.Params{"list": listId, "user": e.Auth.Id},
	)
	if membership == nil {
		return apis.NewForbiddenError("You are not a member of this list.", nil)
	}

	list, err := e.App.FindRecordById("shopping_lists", listId)
	if err != nil {
		return apis.NewNotFoundError("List not found.", nil)
	}

	cutoff := time.Now().Add(-90 * time.Second).UTC().Format("2006-01-02 15:04:05.000Z")
	users, err := e.App.FindRecordsByFilter(
		"users",
		"current_list = {:code} && last_active_at > {:cutoff}",
		"-last_active_at", 50, 0,
		dbx.Params{"code": list.GetString("invite_code"), "cutoff": cutoff},
	)
	if err != nil {
		return apis.NewBadRequestError("Could not load presence.", err)
	}

	type presenceUser struct {
		Id           string `json:"id"`
		Username     string `json:"username"`
		LastActiveAt string `json:"lastActiveAt"`
	}
	out := make([]presenceUser, 0, len(users))
	for _, u := range users {
		out = append(out, presenceUser{
			Id:           u.Id,
			Username:     u.GetString("display_name"),
			LastActiveAt: u.GetDateTime("last_active_at").String(),
		})
	}
	return e.JSON(http.StatusOK, out)
}

func newInviteCode() string {
	return security.RandomStringWithAlphabet(10, inviteAlphabet)
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func defaultPublicDir() string {
	if osutils.IsProbablyGoRun() {
		return "./web/dist"
	}
	return filepath.Join(filepath.Dir(os.Args[0]), "pb_public")
}
