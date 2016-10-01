# elephas2
electron-based popup helper above SAI2

## Status
In prototype. Don't use.

## Features
* Touch support for SAI2 (tap / move / zoom / rotate)
* Popup palette with color history like the one in Krita
* Configurable radial toolbars

## Known issues
* When users touch menubar with their fingers, Windows does not send balanced WM\_POINTERDOWN/WM\_POINTERUP messages and the tap actions will be broken. You should use your digitizer to click the menubar if possible
* Shortcuts will sometimes be sent to floating view unexpectly
