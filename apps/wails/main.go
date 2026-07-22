package main

import (
	"context"
	"embed"
	"log"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"

	"mdx/internal/service"
	"mdx/internal/util"
)

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

	app := application.New(application.Options{
		Name:             "MDX",
		Description:      "A Markdown tools(editor, preview, publish) built with Wails 3 + Vue 3",
		FileAssociations: []string{".md", ".markdown"},
		Services: []application.Service{
			application.NewService(&service.FileService{}),
			application.NewService(&service.FolderService{}),
			application.NewService(workspaceSvc),
			application.NewService(&service.SystemService{}),
			application.NewService(&service.UpdateService{}),
			application.NewService(&service.ImageService{}),
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
			if err := app.Updater.CheckAndInstall(context.Background()); err != nil {
				log.Printf("[updater] check failed: %v", err)
			}
		}()
	})
	app.Menu.Set(menu)

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "MDX",
		Width:  1200,
		Height: 800,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
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
