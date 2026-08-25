require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'AppMemory'
  s.version = package['version']
  s.summary = 'Native device-memory diagnostic for the Pappas Order Management app.'
  s.description = 'Internal Expo module that reports the current app process memory footprint.'
  s.homepage = 'https://pappasoceancatch.com.au'
  s.authors = { 'My Small Business' => 'support@pappasoceancatch.com.au' }
  s.license = { :type => 'Proprietary', :text => 'Copyright My Small Business. All rights reserved.' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/truongnguyen/my-small-business.git', :tag => s.version.to_s }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = 'AppMemoryModule.swift'
  s.swift_version = '5.9'
end
