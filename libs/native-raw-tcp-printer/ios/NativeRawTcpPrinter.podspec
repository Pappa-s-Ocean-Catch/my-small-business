require 'json'

Pod::Spec.new do |s|
  s.name = 'NativeRawTcpPrinter'
  s.version = '0.0.1'
  s.summary = 'Native raw TCP receipt raster printer'
  s.description = 'Internal Expo module that rasterizes and sends receipt images to network TCP printers.'
  s.homepage = 'https://pappasoceancatch.com.au'
  s.authors = { 'My Small Business' => 'support@pappasoceancatch.com.au' }
  s.license = { :type => 'Proprietary', :text => 'Copyright My Small Business. All rights reserved.' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/truongnguyen/my-small-business.git', :tag => s.version.to_s }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
