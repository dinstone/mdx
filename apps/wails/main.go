package main

import (
	"embed"
	"log"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"

	"mdx/internal/service"
	"mdx/internal/util"
)

// mdExts are the file extensions we claim via FileAssociations.  Used to pick
// the document argument out of a second-instance launch (see below).
var mdExts = map[string]bool{".md": true, ".markdown": true}

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	application.RegisterEvent[string]("refresh")
	application.RegisterEvent[string]("workspace:opened")
	application.RegisterEvent[string]("workspace:closed")
	application.RegisterEvent[string]("file:opened")
}

func main() {
	workspaceSvc := &service.WorkspaceService{}
	updateSvc := &service.UpdateService{}

	app := application.New(application.Options{
		Name:             "MDX",
		Description:      "A Markdown tools(editor, preview, publish) built with Wails 3 + Vue 3",
		FileAssociations: []string{".md", ".markdown"},
		// --- Single instance (Windows file-association + relaunch) ---
		// On Windows, double-clicking an .md launches a NEW process with the
		// file path as an argument.  Without a single-instance lock that second
		// process would spawn its own window and the document would not open in
		// the already-running instance.  The lock routes the argument back here
		// via OnSecondInstanceLaunch, so we can open it in the live window.
		// (macOS handles this natively through ApplicationOpenedWithFile.)
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.dinstone.mdx",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				// data.Args[0] is the executable path on Windows; scan for the
				// first .md/.markdown argument and open it in the live instance.
				var fileArg string
				for _, a := range data.Args {
					if mdExts[strings.ToLower(filepath.Ext(a))] {
						fileArg = a
						break
					}
				}
				if fileArg != "" {
					log.Printf("[single-instance] file arg: %s (frontendReady=%v)", fileArg, service.IsFrontendReady())
					if service.IsFrontendReady() {
						application.Get().Event.Emit("file:opened", fileArg)
					} else {
						service.QueueOpenFile(fileArg)
					}
				}
				// Raise the existing window (e.g. relaunch from Start Menu, or a
				// double-click while the app is already open).
				if w := application.Get().Window.Current(); w != nil {
					w.Show()
				}
			},
		},
		Services: []application.Service{
			application.NewService(&service.FileService{}),
			application.NewService(&service.FolderService{}),
			application.NewService(workspaceSvc),
			application.NewService(&service.SystemService{}),
			application.NewService(updateSvc),
			application.NewService(&service.ImageService{}),
			application.NewService(&service.AttachmentService{}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// --- In-app updater (Wails3 pkg/updater) ---
	// 更新源：GitHub Releases（内置 github provider），仓库固定为
	// github.com/dinstone/mdx。Release 需包含一个 macOS 的 .zip 产物以及
	// SHA256SUMS 校验和侧车文件（用于 digest 校验）。
	ghProvider, ghErr := github.New(github.Config{
		Repository: "dinstone/mdx",
		HTTPClient: util.UpdaterHTTPClient(),
	})
	if ghErr != nil {
		log.Fatalf("updater: github.New: %v", ghErr)
	}
	if err := app.Updater.Init(updater.Config{
		CurrentVersion: currentAppVersion(),
		Providers:      []updater.Provider{ghProvider},
	}); err != nil {
		log.Fatalf("updater: Init: %v", err)
	}
	// Hand the running app + updater to the UpdateService so it can drive the
	// background auto-check on launch and push availability to the frontend.
	service.SetApp(app)
	service.SetUpdater(app.Updater)

	menu := app.NewMenu()
	if runtime.GOOS == "darwin" {
		menu.AddRole(application.AppMenu)
	}
	fileMenu := menu.AddSubmenu("File")
	fileMenu.Add("Open Folder...").
		SetAccelerator("CmdOrCtrl+O").
		OnClick(func(_ *application.Context) {
			_, _ = workspaceSvc.PickAndOpen()
		})
	fileMenu.Add("Close Workspace").
		OnClick(func(_ *application.Context) {
			_ = workspaceSvc.Close()
		})
	fileMenu.AddSeparator()
	fileMenu.Add("Quit").
		SetAccelerator("CmdOrCtrl+Q").
		OnClick(func(_ *application.Context) {
			application.Get().Quit()
		})
	menu.AddRole(application.EditMenu)
	menu.AddRole(application.WindowMenu)
	helpMenu := menu.AddSubmenu("Help")
	helpMenu.Add("使用说明").OnClick(func(_ *application.Context) {
		if err := app.Browser.OpenURL("https://github.com/dinstone/mdx"); err != nil {
			log.Printf("[help] open url failed: %v", err)
		}
	})
	helpMenu.AddSeparator()
	helpMenu.Add("检查更新…").OnClick(func(_ *application.Context) {
		go func() {
			if err := updateSvc.InstallUpdate(); err != nil {
				log.Printf("[updater] install failed: %v", err)
			}
		}()
	})
	app.Menu.Set(menu)

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "MDX",
		Width:  1200,
		Height: 800,
		// Windows: drop the native title bar / border (the "ugly window frame").
		// beta.4 keeps WS_THICKFRAME under Frameless, so edges Stay resizable.
		// The frontend renders a custom draggable title bar (AppTitleBar.vue)
		// with min/max/close buttons. macOS keeps its hidden-inset title bar.
		Frameless: runtime.GOOS == "windows",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			// Enables `app-region: drag` CSS so the custom title bar can be dragged.
			NonClientRegionSupport: true,
		},
		BackgroundColour:   application.NewRGB(255, 255, 255),
		URL:                "/",
		UseApplicationMenu: true,
	})

	// Handle opening files via Finder / double-click.
	//
	// Two paths:
	//   Cold launch — frontend not yet loaded.  Queue the file; when the
	//     frontend calls GetPendingOpenFile it will be consumed.
	//   Hot launch  — frontend is already listening on "file:opened".
	//     We can emit the event directly.
	app.Event.OnApplicationEvent(events.Common.ApplicationOpenedWithFile,
		func(event *application.ApplicationEvent) {
			associatedFile := event.Context().Filename()
			log.Printf("[file-assoc] ApplicationOpenedWithFile: %s (frontendReady=%v)", associatedFile, service.IsFrontendReady())
			if service.IsFrontendReady() {
				log.Printf("[file-assoc] frontend is ready, emitting file:opened event")
				app.Event.Emit("file:opened", associatedFile)
			} else {
				log.Printf("[file-assoc] frontend NOT ready, queueing for cold-launch")
				service.QueueOpenFile(associatedFile)
			}
		})

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}

// currentAppVersion returns the running app version, seeded from the build-time
// injected value in the service package (set via -ldflags at build). This is the
// baseline the updater compares releases against, so it must match the GitHub
// release tag (with or without a "v" prefix — the provider normalises it). Using
// the injected value keeps macOS/Windows/Linux consistent and avoids hardcoding
// a stale version that would make the updater misreport availability.
func currentAppVersion() string {
	return service.AppVersion()
}
