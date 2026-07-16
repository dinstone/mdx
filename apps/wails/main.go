package main

import (
	"embed"
	"log"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"mdx/internal/service"
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
		Name:             "MDX Editor",
		Description:      "A Markdown editor built with Wails 3 + Vue 3",
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
	menu.AddRole(application.HelpMenu)
	app.Menu.Set(menu)

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "MDX Editor",
		Width:  1200,
		Height: 800,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(255, 255, 255),
		URL:              "/",
		UseApplicationMenu: true,
	})

	// Handle opening files via Finder / double-click.
	// We emit "file:opened" and let the frontend handle workspace open +
	// setActiveFile.  This avoids double-calling workspaceSvc.Open()
	// (once here, once from the frontend) which would clear activeFileId.
	app.Event.OnApplicationEvent(events.Common.ApplicationOpenedWithFile,
		func(event *application.ApplicationEvent) {
			associatedFile := event.Context().Filename()
			app.Event.Emit("file:opened", associatedFile)
		})

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
