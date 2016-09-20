node-gyp rebuild --target=1.3.5 --arch=x64 --dist-url=https://atom.io/download/atom-shell && ^
del /S /Q tmp && ^
mkdirp tmp\build\Release && ^
xcopy /Y *.js tmp\ && ^
xcopy /Y *.json tmp\ && ^
xcopy /Y /S /I html tmp\html && ^
xcopy /Y /S /I build\Release\*.node tmp\build\Release\ && ^
asar p tmp build\elephas2.asar