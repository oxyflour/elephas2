{
  'targets': [
    {
      'target_name': 'hook',
      'sources': [
        'bindings/hook.cc',
        'bindings/lib/EventEmitter.cc',
        'bindings/lib/SaiHooker.cc',
        'bindings/lib/SaiConnector.cc',
        'bindings/lib/TouchManipulation.cc',
      ],
      'libraries': [ 'user32.lib', 'comctl32.lib' ],
      'include_dirs': [ 'node_modules/nan' ],
    },
    {
      'target_name': 'helper',
      'sources': [
        'bindings/helper.cc'
      ],
      'libraries': [ 'shlwapi.lib', 'kernel32.lib', 'psapi.lib' ],
      'include_dirs': [ 'node_modules/nan' ],
    },
  ],
}