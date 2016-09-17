{
  'targets': [
    {
      'target_name': 'hook',
      'sources': [
        'bindings/hook.cc',
        'bindings/lib/EventEmitter.cc',
        'bindings/lib/SaiHooker.cc',
        'bindings/lib/SaiConnector.cc',
        'bindings/lib/ManipulationEventSink.cc',
        'bindings/lib/utils.cc',
      ],
      'libraries': [ 'user32.lib' ],
      'include_dirs': [ 'node_modules/nan' ],
    },
    {
      'target_name': 'helper',
      'sources': [
        'bindings/helper.cc'
      ],
      'libraries': [ '-lShlwapi.lib', '-lKernel32.lib', '-lPsapi.lib' ],
      'include_dirs': [ 'node_modules/nan' ],
    },
  ],
}