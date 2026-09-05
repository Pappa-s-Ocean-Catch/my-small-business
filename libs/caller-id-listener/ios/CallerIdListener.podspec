require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CallerIdListener'
  s.version        = package['version']
  s.summary        = package['description'] || package['name']
  s.description    = package['description'] || package['name']
  s.license        = package['license'] || 'UNLICENSED'
  s.author         = package['author'] || ''
  s.homepage       = package['homepage'] || 'https://example.com'
  s.platforms      = { :ios => '13.0' }
  s.source         = { git: '' }
  s.source_files   = '**/*.{h,m,swift}'
  s.exclude_files  = 'Tests/**/*'

  s.dependency 'ExpoModulesCore'
end
