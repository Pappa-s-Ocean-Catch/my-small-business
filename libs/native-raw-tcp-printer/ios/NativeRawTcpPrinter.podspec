require 'json'

Pod::Spec.new do |s|
  s.name = 'NativeRawTcpPrinter'
  s.version = '0.0.1'
  s.summary = 'Native raw TCP receipt raster printer'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
